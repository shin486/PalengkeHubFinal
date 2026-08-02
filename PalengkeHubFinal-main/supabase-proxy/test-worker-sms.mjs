// Test the deployed Worker's iProg SMS endpoint end-to-end
// Usage: node test-worker-sms.mjs [+639123456789]

const phone = process.argv[2] || '+639123456789';
const workerUrl = 'https://supabase-proxy.jhayvy.workers.dev/iprog/send-authenticator-sms';

async function main() {
  try {
    console.log(`Sending test OTP SMS to: ${phone}`);
    const res = await fetch(workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone_number: phone, sender_name: 'PalengkeHub' }),
    });
    const text = await res.text();
    console.log('STATUS:', res.status);
    console.log('BODY:', text);
    if (res.ok) {
      const data = JSON.parse(text);
      console.log('\n✅ SMS sent via iProg!');
      console.log('🔢 Verification code:', data.verification_code);
      console.log('⏳ Expires in (min):', data.expires_in_minutes);
    } else {
      console.log('\n❌ Worker SMS endpoint returned an error.');
      console.log('\nCheck that IPROG_API_TOKEN is set as a Cloudflare secret:');
      console.log('  cd supabase-proxy && npx wrangler secret put IPROG_API_TOKEN');
    }
  } catch (err) {
    console.error('REQUEST FAILED:', err.message);
  }
}

main();

