import crypto from 'crypto';

// Copy the EXACT parameter string from your debug output
const paramString = 'amount=100.00&cancel_url=https%3A%2F%2F6c7a-2a09-bac5-d4da-1c3-00-2d-cd.ngrok-free.app%2Fpayment%2Fcancel&custom_str1=test_user_123&item_name=Savings+Deposit&m_payment_id=test_1771020817647&merchant_id=10045849&merchant_key=imirfuzwzn1a7&notify_url=https%3A%2F%2F6c7a-2a09-bac5-d4da-1c3-00-2d-cd.ngrok-free.app%2Fpayfast%2Fnotify&return_url=https%3A%2F%2F6c7a-2a09-bac5-d4da-1c3-00-2d-cd.ngrok-free.app%2Fpayment%2Fsuccess';

// Your passphrase
const passphrase = 'Aa1011111111';

// Add passphrase and hash
const stringToHash = paramString + '&passphrase=' + passphrase;
const signature = crypto.createHash('md5').update(stringToHash).digest('hex');

console.log('='.repeat(60));
console.log('🔐 SIGNATURE VERIFICATION');
console.log('='.repeat(60));
console.log('\n📝 Parameter string:');
console.log(paramString);
console.log('\n🔑 Passphrase:', passphrase);
console.log('\n🔐 String to hash:');
console.log(stringToHash);
console.log('\n✅ Generated signature:', signature);
console.log('\n✅ Your signature from debug:', '0cf030eb5bca5f7582cfb875598ad4c9');
console.log('Match:', signature === '0cf030eb5bca5f7582cfb875598ad4c9' ? '✅ YES' : '❌ NO');
console.log('='.repeat(60));