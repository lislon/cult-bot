import { ContextMessageUpdate } from '../../../src/interfaces/app-interfaces'

export interface AnalyticsEvent {
    ec: string
    ea: string
    v: string
    t: 'event'
}

export interface AnalyticsPageView {
    dp: string
    dt: string
}

export class AnalyticsRecorder {
    private recordsEvent: AnalyticsEvent[] = []
    private recordsPageview: AnalyticsPageView[] = []

    middleware() {
        return async (ctx: ContextMessageUpdate, next: () => Promise<void>) => {
            try {
                return await next()
            } finally {
                ((ctx.ua as any)._queue).forEach((e: any) => {
                    if (e.dp !== undefined) {
                        this.recordsPageview.push(e)
                    } else if (e.ec !== undefined) {
                        this.recordsEvent.push(e)
                    }
                })
            }
        }
    }

    getPageViews(): AnalyticsPageView[] {
        return this.recordsPageview
    }
}