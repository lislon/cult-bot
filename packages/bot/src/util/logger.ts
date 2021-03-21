import util from 'util'
import winston, { format } from 'winston'
import { ContextMessageUpdate } from '../interfaces/app-interfaces'
import { botConfig } from './bot-config'

/**
 * Adds user id and nickname if found. Also formats message to display complex objects
 * @param ctx - telegram context
 * @param msg  - message
 * @param data - object to log
 */
function prepareMessage(ctx: ContextMessageUpdate, msg: string, ...data: any[]) {
    const formattedMessage = data.length ? util.format(msg, ...data) : msg;

    if (ctx && ctx.from) {
        return `[${ctx.from.id}/${ctx.from.username}]: ${formattedMessage}`;
    }

    return `: ${formattedMessage}`;
}

const {combine, timestamp, printf} = format;
function getFormat() {
    if (botConfig.NODE_ENV === 'development' || botConfig.NODE_ENV === 'test') {
        return combine(
            format.errors({stack: true}),
            format.colorize(),
            timestamp({format: 'HH:mm:ss'}),
            format.splat(),
            format.simple(),
            printf(({timestamp, level, message, stack}) => {
                return `[${timestamp}] [${level}] ${message}${stack ? '- ' + stack : ''}`
            })
        )
    } else {
        return combine(
            format.errors({stack: true}),
            format.colorize(),
            format.splat(),
            format.simple(),
            printf(({level, message, stack}) => {
                return `[${level}] ${message}${stack ? '- ' + stack : ''}`;
            })
        )
    }
}

export const loggerTransport = new winston.transports.Console({
    level: botConfig.LOG_LEVEL
})

export const logger = winston.createLogger({
    transports: [
        loggerTransport
    ],
    format: getFormat()
})