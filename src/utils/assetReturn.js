const _rawApi = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '/api';
const API_URL = _rawApi.endsWith('/api') ? _rawApi : `${_rawApi.replace(/\/$/, '')}/api`;

/**
 * Resilient Asset Return helper.
 * 
 * Works across all environments:
 * 1. Tries direct POST /api/assets/:id/return (if available on server)
 * 2. If endpoint not found (404), seamlessly falls back to:
 *    a. Closing active assignment via PUT /api/assignments/:id (status: RETURNED, returnedDate)
 *    b. Updating asset status via PUT /api/assets/:id (status: AVAILABLE, assignedEmployeeId: null, assignmentType: STORE)
 * 3. Clears all frontend caches so dashboards, asset listings, and counters update immediately.
 * 
 * @param {Object} params
 * @param {string} params.assetId - ID of the asset to return
 * @param {string} [params.assetCode] - Code of the asset (AST-xxxxxxxxx)
 * @param {string} [params.assignmentId] - Direct active assignment ID if already known
 * @param {Array} [params.activeAssignments] - List of assignments from parent context to search for active match
 */
export async function returnAssetToStore({
  assetId,
  assetCode,
  assignmentId = null,
  activeAssignments = null
}) {
  if (!assetId) throw new Error('Asset ID is required for check-in');

  const token = localStorage.getItem('token');
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  let returnSucceeded = false;
  let lastError = null;

  // 1. Try modern direct return endpoint
  try {
    const directRes = await fetch(`${API_URL}/assets/${assetId}/return`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (directRes.ok) {
      returnSucceeded = true;
    } else if (directRes.status !== 404) {
      const err = await directRes.json().catch(() => ({}));
      lastError = err.error || err.message;
    }
  } catch (err) {
    lastError = err.message;
  }

  // 2. Resilient multi-tier fallback for environments where direct return endpoint is pending deploy
  if (!returnSucceeded) {
    let assignId = assignmentId;

    // Search active assignments provided by caller
    if (!assignId && Array.isArray(activeAssignments)) {
      const match = activeAssignments.find(a => 
        (a.assetId === assetId || a.asset?.id === assetId || a.asset?.assetCode === assetCode) &&
        a.status === 'ACTIVE'
      );
      if (match) assignId = match.id;
    }

    // If still not found, fetch assignments list to find matching active assignment
    if (!assignId) {
      try {
        const assignListRes = await fetch(`${API_URL}/assignments`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (assignListRes.ok) {
          const all = await assignListRes.json();
          const list = Array.isArray(all) ? all : (all.assignments || []);
          const match = list.find(a => 
            (a.assetId === assetId || a.asset?.id === assetId || a.asset?.assetCode === assetCode) &&
            a.status === 'ACTIVE'
          );
          if (match) assignId = match.id;
        }
      } catch (_) {}
    }

    // Close the active assignment
    if (assignId) {
      try {
        const putAssignRes = await fetch(`${API_URL}/assignments/${assignId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            status: 'RETURNED',
            returnedDate: new Date().toISOString()
          })
        });
        if (putAssignRes.ok) {
          returnSucceeded = true;
        } else {
          const err = await putAssignRes.json().catch(() => ({}));
          lastError = err.error || err.message;
        }
      } catch (err) {
        lastError = err.message;
      }
    }

    // Ensure asset status is set to AVAILABLE and assignedEmployeeId is cleared
    try {
      const putAssetRes = await fetch(`${API_URL}/assets/${assetId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          status: 'AVAILABLE',
          assignedEmployeeId: null,
          assignmentType: 'STORE'
        })
      });
      if (putAssetRes.ok) {
        returnSucceeded = true;
      } else if (!returnSucceeded) {
        const err = await putAssetRes.json().catch(() => ({}));
        lastError = err.error || err.message || 'Asset status update failed';
      }
    } catch (err) {
      if (!returnSucceeded) lastError = err.message;
    }
  }

  if (!returnSucceeded) {
    throw new Error(lastError || 'Return failed');
  }

  // 3. Clear all cached frontend queries
  localStorage.removeItem('analyticsDashboardCache');
  localStorage.removeItem('assetsCache');
  localStorage.removeItem('assignmentsCache');
  localStorage.removeItem('employeesCache');

  return { success: true };
}

