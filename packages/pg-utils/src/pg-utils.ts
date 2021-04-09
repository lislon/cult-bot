import { IColumnConfig } from 'pg-promise'

export function fieldStr<T>(column: string): IColumnConfig<T> {
    return {
        name: column,
        skip: (c: { value: string }) => c.value === null || c.value === undefined
    }
}

// while parsing the type correctly:
export function fieldInt<T>(column: string): IColumnConfig<T> {
    return {
        name: column,
        skip: (c: { value: number }) => c.value === null || c.value === undefined,
        init: ({value, exists}: { value: number, exists: boolean }) => exists ? +value : undefined
    }
}

export function fieldBoolean<T>(column: string): IColumnConfig<T> {
    return {
        name: column,
        skip: (c: { value: boolean }) => c.value === null || c.value === undefined,
        init: ({value, exists}: { value: boolean, exists: boolean }) => exists ? !!value : undefined
    }
}

export function fieldTextArray<T>(column: string): IColumnConfig<T> {
    return {
        name: column,
        cast: 'text[]',
        skip: (c: { value: string[] }) => c.value === null || c.value === undefined
    }
}

export function fieldInt8Array<T>(column: string): IColumnConfig<T> {
    return {
        name: column,
        cast: 'int8[]',
        skip: (c: { value: number[] }) => c.value === null || c.value === undefined
    }
}

export function fieldTimestamptzNullable<T>(column: string): IColumnConfig<T> {
    return {
        name: column,
        cast: 'timestamptz',
        skip: (c: { value: unknown }) => c.value === undefined
    }
}
export function fieldTimestamptzArray<T>(column: string): IColumnConfig<T> {
    return {
        name: column,
        cast: '_timestamptz',
        skip: (c: { value: unknown }) => c.value === undefined
    }
}