import { CardOptions, EventWithPast } from '../../scenes/shared/card-format'
import { Event } from '../../interfaces/app-interfaces'
import { AdminEvent } from '../../database/db-admin'
import path from 'path'
import * as fs from 'fs'
import { readFile, readFileSync } from 'fs'

export interface CardLibrary {
    name: string
    options: CardOptions
    row: Event | AdminEvent | EventWithPast
    expected: string
}

export function cardDesignLibrary(): CardLibrary[] {
    const rootDir = path.resolve(__dirname, `cards`)
    const files = fs.readdirSync(rootDir)
    return files.map(filename => {
        const contents = readFileSync(path.resolve(rootDir, filename), 'utf8')
        const [, expected, options, row] = contents.split(/<pre>|<\/pre>\s*<pre>|<\/pre>/)
        return {
            name: filename,
            row: JSON.parse(row),
            options: JSON.parse(options),
            expected
        } as CardLibrary
    })
}