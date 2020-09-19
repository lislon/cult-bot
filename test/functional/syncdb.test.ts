import { db, dbCfg, pgp } from '../../src/db'

beforeAll(() => {
    expect(dbCfg.connectionString).toContain('test')
})

afterAll(() => {
    pgp.end()
})

describe('db sync test', () => {
    test('tables should be 3',  async () => {
            const newVar = await db.any('SELECT *\n' +
                'FROM pg_catalog.pg_tables\n' +
                'WHERE schemaname != \'pg_catalog\' AND \n' +
                '    schemaname != \'information_schema\';')

            expect(newVar.length).toStrictEqual(3)
            // await pgTeardown()
        }, 100000
    )
})