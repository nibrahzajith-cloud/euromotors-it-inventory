const prisma = require('../prismaClient');
const { evaluateTicketSla } = require('./slaCalculator');

const IS_EMAIL_DISABLED = process.env.DISABLE_EMAIL_NOTIFICATIONS === 'true' || process.env.NODE_ENV !== 'production';

async function notifyUsers({ userIds = [], ticketId = null, type, title, message, link = null, emailEvent = null }) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) return;

  try {
    await prisma.notification.createMany({
      data: uniqueIds.map((userId) => ({
        userId,
        ticketId,
        type,
        title,
        message,
        link,
      })),
    });

    if (emailEvent) {
      const users = await prisma.user.findMany({
        where: { id: { in: uniqueIds }, status: 'ACTIVE' },
        select: { email: true, fullName: true },
      });
      if (users.length > 0) {
        await prisma.emailNotificationLog.createMany({
          data: users.map((u) => ({
            recipientEmail: u.email,
            subject: `[Euro Motors IT Help Desk] ${title}`,
            body: `Hello ${u.fullName},\n\n${message}\n`,
            eventType: emailEvent,
            ticketId,
            status: IS_EMAIL_DISABLED ? 'SUPPRESSED_DEV' : 'QUEUED',
          })),
        });
      }
    }
  } catch (err) {
    console.error('[NOTIFICATION] Failed creating notification:', err.message);
  }
}

async function getUserIdsByRoles(roles) {
  const users = await prisma.user.findMany({
    where: { role: { in: roles }, status: 'ACTIVE' },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

/**
 * Evaluates active tickets against SLA rules and fires approaching / breach notifications once.
 */
async function evaluateAndNotifySla() {
  try {
    const [settings, rules, activeTickets] = await Promise.all([
      prisma.helpDeskSettings.findUnique({ where: { id: 'global' } }),
      prisma.helpDeskSlaRule.findMany(),
      prisma.supportTicket.findMany({
        where: {
          status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'REOPENED'] },
        },
        select: {
          id: true,
          ticketCode: true,
          subject: true,
          priority: true,
          status: true,
          assignedToId: true,
          resolutionDueAt: true,
          firstResponseDueAt: true,
          firstRespondedAt: true,
          slaPausedAt: true,
          slaStatus: true,
          approachingNotifiedAt: true,
          breachNotifiedAt: true,
          escalatedAt: true,
        },
      }),
    ]);

    if (!activeTickets.length) return;

    const ruleMap = Object.fromEntries(rules.map((r) => [r.priority, r]));
    const managerIds = await getUserIdsByRoles(['IT_MANAGER', 'HEAD_OF_IT', 'ADMIN']);
    const headIds = await getUserIdsByRoles(['HEAD_OF_IT', 'ADMIN']);
    const now = new Date();

    for (const t of activeTickets) {
      const rule = ruleMap[t.priority];
      const evalRes = evaluateTicketSla(t, rule, settings, now);

      const updates = {};
      if (evalRes.slaStatus !== t.slaStatus) {
        updates.slaStatus = evalRes.slaStatus;
      }

      if (evalRes.slaStatus === 'APPROACHING' && !t.approachingNotifiedAt) {
        updates.approachingNotifiedAt = now;
        await notifyUsers({
          userIds: [...managerIds, t.assignedToId],
          ticketId: t.id,
          type: 'SLA_APPROACHING',
          title: `SLA Deadline Approaching: ${t.ticketCode}`,
          message: `Ticket "${t.subject}" (${t.priority}) has ${evalRes.remainingMinutes} minutes remaining before SLA resolution deadline.`,
          link: `/helpdesk/tickets/${t.id}`,
          emailEvent: 'SLA_APPROACHING',
        });
      }

      if (evalRes.slaStatus === 'BREACHED' && !t.breachNotifiedAt) {
        updates.breachNotifiedAt = now;
        updates.slaBreachedAt = now;
        updates.escalatedAt = now;

        await prisma.slaBreachLog.create({
          data: {
            ticketId: t.id,
            breachType: 'RESOLUTION',
            dueAt: t.resolutionDueAt || now,
            breachedAt: now,
            overdueMinutes: evalRes.overdueMinutes,
            escalatedToId: headIds[0] || null,
            escalatedToName: 'Head of IT',
          },
        }).catch(() => {});

        await notifyUsers({
          userIds: [...headIds, ...managerIds, t.assignedToId],
          ticketId: t.id,
          type: 'SLA_BREACHED',
          title: `SLA Breached & Escalated: ${t.ticketCode}`,
          message: `Ticket "${t.subject}" (${t.priority}) breached its SLA target by ${evalRes.overdueMinutes} minutes and has been escalated to Head of IT.`,
          link: `/helpdesk/tickets/${t.id}`,
          emailEvent: 'SLA_BREACHED',
        });
      }

      if (Object.keys(updates).length > 0) {
        await prisma.supportTicket.update({
          where: { id: t.id },
          data: updates,
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('[SLA MONITOR] Evaluation notice:', err.message);
  }
}

module.exports = {
  notifyUsers,
  getUserIdsByRoles,
  evaluateAndNotifySla,
};
