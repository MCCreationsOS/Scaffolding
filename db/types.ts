export interface IDatabaseQuery {
    query: IDatabaseSearch,
    limit: number,
    skip: number,
    sort: IDatabaseSort,
    projection: IDatabaseProjection
}

export interface IDatabaseSearch {
    createdDate: Date | {},
    updatedDate: Date | {},
    title: string,
    version: string,
    $text: { $search: string },
    slug: string,
}

export interface IDatabaseSort {
    createdDate : number | {},
    updatedDate : number | {},
    title: number | {},
    rating: number | {},
    "creators.username": number | {} 
}

export interface IDatabaseProjection {
    _id: number,
    title: number,
    "files.minecraftVersion": number,
    shortDescription: number,
    downloads: number,
    rating: 1,
    "creators.username": number,
    images: number,
    slug: number
}