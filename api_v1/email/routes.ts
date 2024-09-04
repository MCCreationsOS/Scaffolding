import { app } from "..";

export function initializeEmailRoutes() {
    app.post("/v1/email/forwarded", (req, res) => {
        fetch(process.env.DISCORD_UPDATE_WEBHOOK_URL + "", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: "New Map Requesting Approval: " + link
            })
        
        }).then(response => {
            console.log(response)
        })
    })
}