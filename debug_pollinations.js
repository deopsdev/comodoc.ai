async function debugPollinations() {
    try {
        console.log('Testing connection to Pollinations AI...');
        const response = await fetch('https://text.pollinations.ai/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            body: JSON.stringify({
                messages: [{ role: 'user', content: 'Hello' }],
                model: 'mistral'
            })
        });

        console.log(`Status: ${response.status} ${response.statusText}`);
        console.log('Headers:', Object.fromEntries(response.headers));
        const text = await response.text();
        console.log('Body preview:', text.substring(0, 200));

    } catch (error) {
        console.error('Error:', error);
    }
}

debugPollinations();
