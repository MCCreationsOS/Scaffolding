import FormData from 'form-data';
// import Mailgun from 'mailgun.js';
import { sendLog } from '../logging/logging.js';
import Mail from '@sendgrid/mail';
import { NotificationDocument } from '../db/types.js';
import { getTranslation } from '../translation/index.js';
Mail.setApiKey(process.env.SENDGRID_API_KEY + "");

export function approvedEmail(to: string, link: string, title: string) {
    Mail.send({
        to: to,
        from: 'MCCreations <mail@mccreations.net>',
        subject: title + " Has Been Approved!",
        content: [
            {
                type: 'text/html',
                value: "blank"
            }
        
        ],
        templateId: "d-567ca9ab875542f6b34d7ac064865a7d",
        dynamicTemplateData: {
            contentLink: link,
            contentTitle: title
        }
    })
}

export function forgotPasswordEmail(to: string, resetToken: string) {
    Mail.send({
        to: to,
        from: 'MCCreations <mail@mccreations.net>',
        content: [
            {
                type: 'text/html',
                value: "blank"
            }
        
        ],
        templateId: "d-2d2de0fcb0a94ccc884cf71bd3ff4a7d",
        dynamicTemplateData: {
            email: to,
            resetLink: "https://next.mccreations.net/reset_password?token=" + resetToken
        }
    })
}

export function requestApprovalEmail(link: string) {
    Mail.send({
        to: "crazycowmm@gmail.com",
        from: 'MCCreations <mail@mccreations.net>',
        content: [
            {
                type: 'text/html',
                value: "blank"
            }
        
        ],
        templateId: "d-ae90ac85d7f643b89b5321ebb44756d3",
        dynamicTemplateData: {
            previewContent: link
        }
    })
}

export function notificationEmail(to: string, notifications: NotificationDocument[], frequency: "weekly" | "daily", types: string[]) {
    let days = "day"
    if(frequency === "weekly") {
        days = "week"
    }

    
    Mail.send({
        to: to,
        from: 'MCCreations <mail@mccreations.net>',
        subject: "Your " + types.join(", ") + " notifications for the past " + days,
        content: [
            {
                type: 'text/html',
                value: "blank"
            }
            
        ],
        templateId: "d-88659d28071e4da69745b7f4ef481205",
        dynamicTemplateData: {
            notifications: notifications.map(n => {
                let link = "https://mccreations.net/" + n.link

                if(link.includes("wall")) {
                    let creator = link.split("/")[2]
                    link = `/creator/${creator}#wall_title`
                } else {
                    link = link + "#comments_title"
                }

                return {
                    title: (typeof n.title === "string" ? n.title : getTranslation("en-US", n.title.key, n.title.options)),
                    body: (typeof n.body === "string" ? n.body : getTranslation("en-US", n.body.key, n.body.options)),
                    link: link
                }
            }),
            days: days,
            types: types.join(", ")
        }
    })
}

// const mailgun = new Mailgun.default(FormData)
// const mg = mailgun.client({username: 'api', key: process.env.MAILGUN_KEY + ""})


// export function email(to: string, subject:string, content: string) {
//     mg.messages.create('mail.mccreations.net', {
//         from: 'MCCreations <no-reply@mccreations.net>',
//         to: to,
//         subject: subject,
//         text: content
//     })
// }

// function sendEmailTemplate(to: string, template: string, subject: string, variables: any) {
//     mg.messages.create('mail.mccreations.net', {
//         from: 'MCCreations <no-reply@mccreations.net>',
//         to: to,
//         subject: subject,
//         template: template,
//         "t:email": to,
//         't:variables': JSON.stringify(variables)
//     }).catch(e => {
//         throw e;
//     })
// }

// export function forgotPasswordEmail(to: string, resetToken: string) {
//     try {
//         sendEmailTemplate(to, "forgot_password", "Password Reset for " + to, {
//                 email: to,
//                 resetLink: "https://next.mccreations.net/reset_password?token=" + resetToken
//             })
//     } catch (e) {
//         sendLog("forgotPasswordEmail", e)
//         throw e;
//     }
// }

// export function requestApprovalEmail(link: string) {
//     try {
//         sendEmailTemplate("crazycowmm@gmail.com", "request_approval", "New Map Requesting Approval", {
//             previewContent: link
//         })
//     } catch(e) {
//         sendLog("requestApprovalEmail", e)
//         console.log(e)
//     }
// }

// export function approvedEmail(to: string, link: string, title: string) {
//     try {
//         sendEmailTemplate(to, "approved", title + " Has Been Approved!", {
//             contentLink: link,
//             contentTitle: title
//         })
//     } catch(e) {
//         sendLog("approvedEmail", e)
//         console.log(e)
//     }
// }