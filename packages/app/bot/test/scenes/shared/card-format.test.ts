import { cardFormat } from '../../../src/scenes/shared/card-format'
import { date } from '../../util/timetable-util'
import { cardDesignLibrary, CardLibrary } from '../../../src/lib/card-format/card-design-library'

const prepare = (str: string) => {
    return str.trim().split(/[\n\r]+/).map(l => l.trim()).join('\n')
}

describe('test card design', () => {
    const cardLibrary = cardDesignLibrary()

    test.each(cardLibrary.map(r => [r.name, r]))(
        '%s',
        (name, cardLib) => {
            const x = cardLib as CardLibrary
            const card = cardFormat(x.row, {...x.options, now: date('2020-01-01')})
            expect(prepare(card)).toEqual(prepare(x.expected))
        },
    )

})
