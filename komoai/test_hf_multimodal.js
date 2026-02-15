// HF Router multimodal integration test — skips if HF_TOKEN is not set
(async () => {
  const HF = process.env.HF_TOKEN;
  if (!HF) {
    console.log('SKIP: HF_TOKEN not set. Set HF_TOKEN to run this multimodal test.');
    process.exit(0);
  }

  const fetch = global.fetch || (await import('node-fetch')).default;

  console.log('Running /chat multimodal test (Hugging Face Router)');
  try {
    const res = await fetch('http://localhost:3030/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'You are Komodoc test assistant.' },
          { role: 'user', content: [
              { type: 'text', text: 'Describe this image in one sentence.' },
              { type: 'image_url', image_url: { url: 'https://cdn.britannica.com/61/93061-050-99147DCE/Statue-of-Liberty-Island-New-York-Bay.jpg' } }
            ] }
        ]
      })
    });

    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Body:', text);

    if (res.status !== 200) process.exit(2);
    const json = JSON.parse(text);
    if (!json.reply) {
      console.error('No reply field in response');
      process.exit(3);
    }
    console.log('OK — reply preview:', json.reply.slice(0, 200));
    process.exit(0);
  } catch (e) {
    console.error('Test failed:', e);
    process.exit(4);
  }
})();