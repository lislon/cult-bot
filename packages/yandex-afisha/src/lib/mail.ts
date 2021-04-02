import formData from 'form-data'

import Mailgun from 'mailgun.js'
import { appConfig } from '../app-config'

export function mailgun(): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mailgun = new Mailgun(formData as any)
    const mg = mailgun.client({username: 'api', key: appConfig.MAILGUN_API_KEY, url: 'https://api.eu.mailgun.net'})

    mg.messages.create('sandbox-123.mailgun.org', {
        from: "Excited User <mailgun@sandbox-123.mailgun.org>",
        to: ["lislon@mail.ru"],
        subject: "Hello",
        text: "Testing some Mailgun awesomness!",
        html: "<h1>Testing some Mailgun awesomness!</h1>"
    })
        .then(msg => console.log(msg)) // logs response data
        .catch(err => console.log(err)); // logs any error

}

