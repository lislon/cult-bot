import util from 'util';
import winston, { format } from 'winston';
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
const logFormat = printf(info => {
    return `[${info.timestamp}] [${info.level}] ${info.message}`;
});

const logger = winston.createLogger({
    transports: [
        new winston.transports.Console({
            level: 'silly'
        })
    ],
    format: combine(
            format.colorize(),
            botConfig.NODE_ENV === 'development' ? timestamp({ format: 'HH:mm:ss' }) : { transform: (info) => info },
            format.splat(),
            format.simple(),
            logFormat
    )
});

if (botConfig.NODE_ENV !== 'production') {
    logger.debug('Logging initialized at debug level');
}

const loggerWithCtx = {
    debug: (ctx: ContextMessageUpdate, msg: string, ...data: any[]) =>
        logger.debug(prepareMessage(ctx, msg, ...data)),
    error: (ctx: ContextMessageUpdate, msg: string, ...data: any[]) =>
        logger.error(prepareMessage(ctx, msg, ...data))
};


export { loggerWithCtx, logger }
