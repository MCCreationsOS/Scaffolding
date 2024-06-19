import Mail from '@sendgrid/mail';
Mail.setApiKey(process.env.SENDGRID_API_KEY + "");
export function approvedEmail(to, link, title) {
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
    });
}
export function forgotPasswordEmail(to, resetToken) {
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
    });
}
export function requestApprovalEmail(link) {
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
    });
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
