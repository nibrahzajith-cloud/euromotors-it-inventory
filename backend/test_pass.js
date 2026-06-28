const crypto = require('crypto');
const bcrypt = require('bcryptjs');

async function test() {
   try {
     const tempPassword = crypto.randomBytes(4).toString('hex');
     const salt = await bcrypt.genSalt(10);
     const passwordHash = await bcrypt.hash(tempPassword, salt);
     console.log('SUCCESS', tempPassword, passwordHash);
   } catch(e) {
     console.error('ERROR', e);
   }
}
test();
