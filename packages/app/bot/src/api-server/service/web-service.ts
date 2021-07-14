import { db } from '../../database/db';
import { AllExhibitionsRequest, AllExhibitionsResponse } from '@culthub/interfaces/typings/api/web';

export async function getAllExhibitions(req: AllExhibitionsRequest): Promise<AllExhibitionsResponse> {
    return await db.tx(async dbTx => {
        const exhibitions = await db.repoEventsCommon.getExhibitions()
        return {
            exhibitions
        }
    })
}