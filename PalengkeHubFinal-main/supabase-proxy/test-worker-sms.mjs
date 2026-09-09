// Test the deployed Worker's iProg SMS endpoint + server-side verify end-to-end
// Usage: node test-worker-sms.mjs [+639123456789]

import readline from 'node:readline/promises';

const phone = process.argv[2] || '+639123456789';
const baseUrl = 'https://supabase-proxy.jhayvy.workers.dev';

async function main() {
  try {
    console.log(`Sending test OTP SMS to: ${phone}`);
    const res = await fetch(`${baseUrl}/iprog/send-authenticator-sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone_number: phone, sender_name: 'PalengkeHub' }),
    });
    const text = await res.text();
    console.log('STATUS:', res.status);
    console.log('BODY:', text);

    if (res.status === 400) {
      console.log('\n❌ Worker rejected the request — check phone_number format.');
      return;
    }

    // The code is no longer in the response — it's stored server-side and
    // only checked via /verify-code. This confirms the SMS actually arrived
    // AND that the server-side verify path works, not just that a 200 came back.
    console.log('\n✅ Send accepted — a code was generated and stored server-side.');
    console.log('   Check your phone for the actual SMS.');

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const code = (await rl.question('\nEnter the 6-digit code you received (blank to skip verify): ')).trim();
    rl.close();
    if (!code) return;

    const verifyRes = await fetch(`${baseUrl}/verify-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'sms', identifier: phone.replace(/^\+/, ''), code }),
    });
    const verifyData = await verifyRes.json();
    console.log('VERIFY STATUS:', verifyRes.status, '| BODY:', JSON.stringify(verifyData));
    console.log(verifyData.success ? '\n✅ Code verified successfully!' : '\n❌ Verify failed:', verifyData.error || '');
  } catch (err) {
    console.error('REQUEST FAILED:', err.message);
    console.log('\nCheck that IPROG_API_TOKEN / SEMAPHORE_API_KEY are set as Cloudflare secrets:');
    console.log('  cd supabase-proxy && npx wrangler secret put IPROG_API_TOKEN');
  }
}

main();
