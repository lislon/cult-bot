import React from 'react'
import { Event } from '../interfaces/app-interfaces'
import { formatPrice, parsePrice } from '../lib/price-parser'
import { filterTagLevel2, formatCardTimetable } from '../scenes/shared/card-format'
import { cleanTagLevel1 } from '../util/tag-level1-encoder'
import { i18n } from '../util/i18n'
import { formatDuration } from '../lib/duration-formatter'
import { parseDurationSimple } from '../lib/duration-parser'

export function Event(event: Event) {
    const icon = i18n.t(`ru`, `shared.category_icons.${event.category}`)
    const title = i18n.t(`ru`, `shared.category_single_title.${event.category}`)

    return (
        <html>
        <body>
        <aside>
            <img src='https://i.ibb.co/cCdrkmL/photo-2021-01-24-17-39-12.jpg'/>
        </aside>
        <article>
            <h2>
                {icon}
                {event.title}
            </h2>
            <p>
                {event.tag_level_1.map(t => cleanTagLevel1(t)).join(' ')}
            </p>
            <p>
                {event.description}
            </p>
        </article>
        <aside>
            <section>
                <p className='place'>
                    🌐 {event.place}
                </p>
                <address>
                    📍 {event.address}
                    <a href={event.geotag}>(Я.Карта)</a>
                </address>
                <p className='timetable'>
                    {formatCardTimetable(event, { now: new Date() })}
                </p>
                <p className='timetable'>
                    🕐 {formatDuration(parseDurationSimple(event.duration))}
                </p>
                <p className='price'>
                    💳 {formatPrice(parsePrice(event.price))}
                </p>
                <p className='url'>
                    <a href={event.url}>Ссылка на событие</a>
                </p>
                <p className='tagLevel3'>
                    {[...event.tag_level_3, ...(filterTagLevel2(event))].join(' ')}
                </p>
            </section>
        </aside>
        </body>
        </html>
    )
}