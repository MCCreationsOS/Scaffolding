import Stripe from "stripe";
import { app } from "..";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY + "")

export function initializePaymentRoutes() {
    app.post('/payments/donate', async (req, res) => {
        const amount = req.body.amount;
        if(!amount) {
            res.status(400).send({error: "Amount is required"});
            return;
        }
        let pId = ""

        switch(amount) {
            case 5:
                pId = "price_1PpL4RF1wYFwxaSDgUfbg4pQ"
                break;
            case 10:
                pId = "price_1PpL5JF1wYFwxaSDrg9vOjO1"
                break;
            case 15:
                pId = "price_1PpL5qF1wYFwxaSDfnkXbA6e"
                break;
        }

        try {
            const session = await stripe.checkout.sessions.create({
                line_items: [
                    {
                        price: pId,
                        quantity: 1
                    }
                ],
                mode: 'payment',
                success_url: 'https://mccreations.net',
                cancel_url: 'https://mccreations.net',
            })
    
            res.send({url: session.url})
        } catch (e) {
            res.status(500).send({error: e.message})
        }
    })
}