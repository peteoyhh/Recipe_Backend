// scripts/fix-user-ids.js

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user');

async function fixUserIds() {
  try {
    console.log('connecting...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('connection sucessful\n');

    const usersWithoutId = await User.find({
      $or: [
        { id: null },
        { id: { $exists: false } }
      ]
    }).sort({ createdAt: 1 });  

    console.log(`found ${usersWithoutId.length} users need fix\n`);

    if (usersWithoutId.length === 0) {
      console.log('no user need fix');
      await mongoose.disconnect();
      return;
    }

    const lastUserWithId = await User.findOne({ 
      id: { $exists: true, $ne: null } 
    }).sort({ id: -1 });

    let nextNum = 1;
    if (lastUserWithId && lastUserWithId.id) {
      const match = lastUserWithId.id.match(/^u(\d+)$/);
      if (match) {
        nextNum = parseInt(match[1]) + 1;
      }
    }

    console.log(`start from u${String(nextNum).padStart(3, '0')} distrbute id...\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const user of usersWithoutId) {
      try {
        const newId = `u${String(nextNum).padStart(3, '0')}`;
        
        await User.updateOne(
          { _id: user._id },
          { $set: { id: newId } }
        );

        console.log(`✓ User ${user.username} (${user.email}) assinged to id: ${newId}`);
        nextNum++;
        successCount++;
      } catch (error) {
        console.error(`✗ fix user ${user.username} failed:`, error.message);
        errorCount++;
      }
    }

    console.log(`\finished`);
    console.log(`sucessful: ${successCount} users`);
    console.log(`failed: ${errorCount} users`);

    await mongoose.disconnect();
    console.log('\connection to the database failed');

  } catch (error) {
    console.error('error happened:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

fixUserIds();

