import FormData from 'form-data';
import Mailgun from 'mailgun.js';
const mailgun = new Mailgun.default(FormData)
const mg = mailgun.client({username: 'api', key: '***REMOVED***'})


export function email(to: string, subject:string, content: string) {
    mg.messages.create('mail.mccreations.net', {
        from: 'MCCreations <no-reply@mccreations.net>',
        to: to,
        subject: subject,
        text: content
    })
}

function sendEmailTemplate(to: string, template: string, variables: any) {
    mg.messages.create('mail.mccreations.net', {
        from: 'MCCreations <no-reply@mccreations.net>',
        to: to,
        subject: "Password reset for " + to,
        template: template,
        "t:email": to,
        't:variables': JSON.stringify(variables)
    })
}

export function forgotPasswordEmail(to: string, resetToken: string) {
    sendEmailTemplate(to, "forgot_password", {
            email: to,
            resetLink: "https://next.mccreations.net/reset_password?token=" + resetToken
        })
}