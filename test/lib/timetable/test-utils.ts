import { parseISO } from 'date-fns/fp'
import { parse } from 'date-fns'

export function date(s: string) {
    if (s.length === 'yyyy-MM-dd'.length) {
        return parseISO(s)
    }
    return parse(s, 'yyyy-MM-dd HH:mm', new Date())
}

export function interval(s: string) {
    const [from, to] = s.replace(/[()\[\]]/g, '').split(/\s*,\s*/)
    return { start: date(from), end: date(to) }
}

