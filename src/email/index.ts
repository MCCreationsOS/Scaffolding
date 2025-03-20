import Mail from '@sendgrid/mail';
import { NotificationDocument } from '../database/models/notifications';
import { env } from '../env';
import { getTranslation } from '../translation';
// import { getTranslation } from '../translation'
Mail.setApiKey(env.SENDGRID_API_KEY);

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
            resetLink: "https://mccreations.net/reset_password?token=" + resetToken
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