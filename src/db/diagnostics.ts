import { IInitOptions } from 'pg-promise'
import pgMonitor from 'pg-monitor'
import { botConfig } from '../util/bot-config'

export class Diagnostics {
    // Monitor initialization function;
    static init<Ext = {}>(options: IInitOptions<Ext>) {
        if (botConfig.NODE_ENV === 'development') {
            // In a DEV environment, we attach to all supported events:
            pgMonitor.attach(options);
        } else {
            // In a PROD environment we should only attach to the type of events
            // that we intend to log. And we are only logging event 'error' here:
            pgMonitor.attach(options, ['error']);
        }
    }
}
