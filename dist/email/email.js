import FormData from 'form-data';
import Mailgun from 'mailgun.js';
const mailgun = new Mailgun.default(FormData);
const mg = mailgun.client({ username: 'api', key: '***REMOVED***' });
export function email(to, subject, content) {
    mg.messages.create('mail.mccreations.net', {
        from: 'MCCreations <no-reply@mccreations.net>',
        to: to,
        subject: subject,
        text: content
    });
}
function sendEmailTemplate(to, template, subject, variables) {
    mg.messages.create('mail.mccreations.net', {
        from: 'MCCreations <no-reply@mccreations.net>',
        to: to,
        subject: subject,
        template: template,
        "t:email": to,
        't:variables': JSON.stringify(variables)
    }).catch(e => {
        throw e;
    });
}
export function forgotPasswordEmail(to, resetToken) {
    try {
        sendEmailTemplate(to, "forgot_password", "Password Reset for " + to, {
            email: to,
            resetLink: "https://next.mccreations.net/reset_password?token=" + resetToken
        });
    }
    catch (e) {
        throw e;
    }
}
export function requestApprovalEmail(link) {
    try {
        sendEmailTemplate("crazycowmm@gmail.com", "request_approval", "New Map Requesting Approval", {
            previewContent: link
        });
    }
    catch (e) {
        console.log(e);
    }
}
export function approvedEmail(to, link, title) {
    try {
        sendEmailTemplate(to, "approved", title + " Has Been Approved!", {
            contentLink: link,
            contentTitle: title
        });
    }
    catch (e) {
        console.log(e);
    }
}
