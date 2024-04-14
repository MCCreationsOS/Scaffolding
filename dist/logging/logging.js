export function sendLog(from, e) {
    try {
        fetch(`https://api.mccreations.net/bamboo/v1/send-log`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: `Encountered error in ${from} \n${new Error().stack} \nError: ${e}`
        });
    }
    catch (e) {
        console.error(e);
    }
}
