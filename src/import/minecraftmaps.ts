import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { ContentType, Creation } from "../schemas/creation";
import { JSDOM } from 'jsdom'
import { UserTypes } from '../schemas/user';
import { ObjectId } from 'mongodb';
import { ProgressStream } from '../utils/creations';

export default async function fetchFromMCMaps(url: string, stream: ProgressStream) {
    const mapInfoLocator = 'Map Info</h2>\n</center></td>\n</tr>\n</tbody>\n</table>'


    const pictureLocator = '<table style="width: 100%;" border="0" cellspacing="0" cellpadding="0">\n<tbody>\n<tr>\n<td class="info_title"><center>\n<h2>Pictures</h2>\n</center></td>\n</tr>\n</tbody>\n</table>'
    const changelogLocator = '<table border="0" width="98%" cellspacing="0" cellpadding="0">\n<tbody>\n<tr>\n<td class="info_title">\n<h2><center>Changelog</center></h2>\n</td>\n</tr>\n</tbody>\n</table>'
    let res = await fetch(url)
    if(!res.ok) return `Error fetching MCMaps: ${res.statusText}`;
    console.log("Got response from MinecraftMaps")
    try {
        let html = new JSDOM(await res.text()).window.document
        let descTable = html.querySelectorAll('table')[1].querySelector('td')?.innerHTML
        let statsPanel = html.querySelector('div.stats_data')?.querySelectorAll('table')[1]
        if(!descTable) return "Error fetching MCMaps: No description table found";
        let mapInfoStart = descTable.indexOf(mapInfoLocator)
        let pictureStart = descTable.indexOf(pictureLocator)
        let changelogStart = descTable.indexOf(changelogLocator)
    
        let title = html.querySelector('h1')?.textContent?.trim();
        if(!title) return "Error fetching MCMaps: No title found";
        let slug = title.toLowerCase().replace(/\s/g, "_").replace(/[^a-zA-Z0-9_]/g, "")
        let description = ""
        if(descTable.includes(pictureLocator)) {
            description = descTable.substring(mapInfoStart + mapInfoLocator.length, pictureStart)
        } else {
            description = descTable.substring(mapInfoStart + mapInfoLocator.length, changelogStart)
        }
        description.replace(/\<table style="width: 98%;" border="0" cellspacing="0" cellpadding="0"\>\n\<tbody\>\n\<tr>\n\<td class="info_title"><center>/g, "")
        description.replace(/\<\/center\>\<\/td\>\n\<\/tr\>\n\<\/tbody\>\n\<\/table>/g, "")
        let shortDescription = ''
        let downloads = 0;
        let views = 0;
        let rating = 0;
        let createdDate = new Date();
        let username = statsPanel?.querySelectorAll('tr')[0].querySelectorAll('span')[1].textContent + ""
    
        let map: Creation = {
            _id: new ObjectId(),
            title: title,
            slug: slug,
            description: description,
            shortDescription: shortDescription,
            status: 0,
            downloads: downloads,
            views: views,
            rating: rating,
            createdDate: createdDate,
            images: [],
            creators: [{username: username, _id: new ObjectId(), type: UserTypes.Account, handle: "", email: ""}],
            importedUrl: url,
            type: 'map',
            ratings: [],
            updatedDate: createdDate,
            tags: []
        }
    
        map.files = [{
            type: 'world', 
            url: "https://minecraftmaps.com" + html.querySelector('.jdbutton')?.getAttribute('href'), 
            minecraftVersion: [statsPanel?.querySelectorAll('tr')[3].querySelectorAll('span')[1].textContent + ""], 
            contentVersion: statsPanel?.querySelectorAll('tr')[2].querySelectorAll('span')[1].textContent + "", 
            createdDate: new Date()}]
    
        // let images = html.querySelector('table')?.querySelector('table')?.querySelector('td')?.querySelectorAll('img')
    
        map.images.push(html.querySelector('.map-images')?.getAttribute('src')!)
        console.log("Map created\n" + JSON.stringify(map, null, 2))
        return map;
    } catch(e) {
        return `Error fetching MCMaps: ${e}`;
    }
}