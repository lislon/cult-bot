import { SpreadSheetValidationError } from '../../dbsync/dbsync'

export const POSTS_PER_PAGE_ADMIN = 10
export const menuCats = [
    ['theaters', 'exhibitions'],
    ['movies', 'events'],
    ['walks', 'concerts']
]

export function totalValidationErrors(errors: SpreadSheetValidationError[]) {
    return errors.reduce((total, e) => total + e.extIds.length, 0)
}