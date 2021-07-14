function makeCloseTags(lastOpenedTags: string[]): string {
    return lastOpenedTags.map(t => `</${t}>`).join('')
}

function makeOpenTags(lastOpenedTags: string[]): string {
    return lastOpenedTags.map(t => `<${t}>`).join('')
}
// assumption - we have always room for clos tags
export function chunkString(str: string, size: number): string[] {
    const spacePieces = str.split('\n')
    return spacePieces.reduce(function (chunks, piece, index) {
        const isFirstPiece = index === 0

        let currentChunk = chunks[chunks.length - 1]
        const chunkSeparator = isFirstPiece ? '' : '\n'

        // const oldTagsFinalizer = makeCloseTags(chunksOpenedTags)

        const chunksOpenedTags = findOpenedTags([], currentChunk)
        const pieceOpenedTags = findOpenedTags(chunksOpenedTags, piece)


        // If a piece is simply too long, split it up harshly
        if (piece.length > size) {
            // Add whatever we can to the current
            const startingPieceIndex = size - (chunkSeparator + currentChunk).length
            currentChunk += chunkSeparator + piece.substring(0, startingPieceIndex)
            chunks[chunks.length - 1] = currentChunk

            // Then just add the rest to more chunks
            const leftover = piece.substring(startingPieceIndex)
            for (let i = 0; i < leftover.length; i += size) {
                chunks.push(leftover.substring(i, i + size))
            }
        }
        // Otherwise try to split nicely at spaces
        else if ((currentChunk + chunkSeparator + piece + makeCloseTags(pieceOpenedTags)).length <= size) {
            currentChunk += chunkSeparator + piece
            chunks[chunks.length - 1] = currentChunk
        }
        // If we simply reached max for this chunk, move to the next one
        else {
            const closeTags = makeCloseTags(chunksOpenedTags)
            if (chunks[chunks.length - 1].length + closeTags.length < size) {
                chunks[chunks.length - 1] += closeTags
            }
            chunks.push(makeOpenTags(chunksOpenedTags) + piece)
        }

        return chunks
    }, [''])
}

function findOpenedTags(alreadyOpened: string[], str: string): string[] {
    const openedTags = [...alreadyOpened]

    const tagIndex = str.indexOf('<')
    if (tagIndex >= 0) {
        const closeTagIndex = str.indexOf('>', tagIndex)

        if (str.length > tagIndex && str[tagIndex + 1] == '/') {
            const closedTag = str.substring(tagIndex + 2, closeTagIndex)
            if (openedTags[openedTags.length - 1] === closedTag) {
                openedTags.length--;
            } else {
                // throw new Error('wtf, cant find ' + closedTag)
            }
        } else {
            const openedTag = str.substring(tagIndex + 1, closeTagIndex)
            openedTags.push(openedTag)
        }
    }
    return openedTags
}
