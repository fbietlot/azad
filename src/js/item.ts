/* Copyright(c) 2017-2021 Philip Mulcahy. */

import { match } from 'assert';
import * as azad_entity from './entity';
import * as util from './util';

export interface IItem extends azad_entity.IEntity {
    description: string;
    order_date: string;
    order_detail_url: string;
    order_id: string;
    price: string;
    quantity: number;
    url: string;
    stat_strategy : string
};

export type Items = Record<string, string>;

type ItemsExtractor = (
    order_id: string,
    order_date: string,
    order_detail_url: string,
    order_elem: HTMLElement,
    context: string,
) => IItem[];

export function extractItems(
    order_id: string,
    order_date: string,
    order_detail_url: string,
    order_elem: HTMLElement,
    context: string,
): IItem[] {
    const strategies: ItemsExtractor[] = [
        strategy0,
        strategy4,
        strategy1,
        strategy2,
        strategy3,
     ];
    for (let i=0; i!=strategies.length; i+=1) {
        const strategy: ItemsExtractor = strategies[i];
        try {
            const items = strategy(
                order_id,
                order_date,
                order_detail_url,
                order_elem,
                context + ';extractItems:' + strategy.name,
            );
            if (items.length) {
                items.map(item => item.stat_strategy = strategy.name)
                return items;
            }
        } catch (ex) {
            console.error(strategy.name + ' ' + ex);
        }
    }
    return [];
}

function strategy0(
    order_id: string,
    order_date: string,
    order_detail_url: string,
    order_elem: HTMLElement,
    context: string
): IItem[] {
    const item_xpath = '//div[' +
        'contains(@class, "fixed-left-grid-inner") and ' +
        './/a[contains(@href, "/gp/product/")] and ' +
        './/*[contains(@class, "price")]' +
    ']';
    const findMultipleNodeValues = util.findMultipleNodeValues;
    const itemElems: Node[] = findMultipleNodeValues(
        item_xpath,
        order_elem
    );
    const items: IItem[] = <IItem[]>itemElems.map( itemElem => {
        const link = <HTMLElement>util.findSingleNodeValue(
            './/a[@class="a-link-normal" and contains(@href, "/gp/product/") and not(img)]',
            <HTMLElement>itemElem,
            context,
        );
        const description = util.defaulted(link.textContent, '').trim();
        const url = util.defaulted(link.getAttribute('href'), '').trim();
        let qty: number = 0;
        try {
            qty = parseInt(
                util.defaulted(
                    util.findSingleNodeValue(
                        './/span[@class="item-view-qty"]',
                        <HTMLElement>itemElem,
                        context,
                    ).textContent,
                    '1'
                ).trim()
            );
        } catch(ex) {
            qty = 1;
            if (!String(ex).includes('match')) {
                console.log(ex);
            }
        }
        let price = '';
        try {
            const priceElem = <HTMLElement>util.findSingleNodeValue(
                './/*[contains(@class, "price")]',
                <HTMLElement>itemElem,
                context,
            );
            price = util.defaulted(priceElem.textContent, '').trim();
        } catch(ex) {
            console.warn('could not find price for: ' + description);
        }
        return {
            description: description,
            order_date: order_date,
            order_detail_url: order_detail_url,
            order_id: order_id,
            price: price,
            quantity: qty,
            url: url,
        } 
    });
    return items;
}

// Digital orders.
function strategy1(
    order_id: string,
    order_date: string,
    order_detail_url: string,
    order_elem: HTMLElement,
    context: string,
): IItem[] {
    const itemElems: Node[] = util.findMultipleNodeValues(
        '//*[contains(text(), "Ordered")'
        + 'or contains(text(), "Commandé") or contains(text(), "commandé")'
        + ']/parent::*/parent::*/parent::*',
        order_elem
    );
    const items: IItem[] = <IItem[]>itemElems.map( itemElem => {
        let link = <HTMLElement>util.findSingleNodeValue(
            './/a[contains(@href, "/dp/")]',
/* move to strategy4
            +' | .//b[contains(text(), "audio")]', // For Audible Subscription (amazon.fr : OK - Others to be checked)
*/
            <HTMLElement>itemElem,
            context,
        );
        const description = util.defaulted(link.textContent, '').trim();
        const url = util.defaulted(link.getAttribute('href'), '').trim();
        let debug_regex : RegExp = /Qty: | Qté\s:\s(\d+)/;
        const qty_match = link.parentNode
                             ?.parentNode
                             ?.textContent
                             ?.match(debug_regex);
        const sqty = qty_match ? qty_match[1] : '1';
        const qty = parseInt(sqty);
        let price_match = link.parentNode
                               ?.parentNode
                               ?.nextSibling
                               ?.nextSibling
                               ?.textContent
                               ?.match(util.moneyRegEx())
        if  (!price_match){
            price_match = (<HTMLElement>link.parentNode)
                                ?.nextElementSibling
                                ?.textContent
                                ?.match(util.moneyRegEx())
        };
        const price = price_match ? price_match[1] : '';
        return {
            description: description,
            order_date: order_date,
            order_detail_url: order_detail_url,
            order_id: order_id,
            price: price,
            quantity: qty,
            url: url,
        } 
    });
    return items;
}


// Digital orders with no link.
// Let's try a (probably) more generic approach 
function strategy4(
    order_id: string,
    order_date: string,
    order_detail_url: string,
    order_elem: HTMLElement,
    context: string,
): IItem[] {
    const item_xpath = 
        '//*[contains(text(), "Ordered") or contains(text(), "Commandé") or contains(text(), "commandé") ]' // Header of Items table
        + '/parent::*/parent::*/parent::tbody/'                         // Items table
        + 'tr[position()!=1 and position()<last()]/'                   // All rows of items expect header and footer
        + '/td[1]';                                                       //the first cell with all info except the price
    const findMultipleNodeValues = util.findMultipleNodeValues;
    const itemElems: Node[] = findMultipleNodeValues(
        item_xpath,
        order_elem
    );
    const items: IItem[] = <IItem[]>itemElems.map( itemElem => {
        let description:string;
        let url : string;
        let qty : number;
        let price : string;

        try{
            const link : HTMLElement = <HTMLElement>util.findSingleNodeValue(
                './/a[contains(@href, "/dp/")]',
                <HTMLElement>itemElem,
                context
            );
            url = util.defaulted(link.getAttribute('href'), '').trim();
        }
        catch{};
        let debug_regex : RegExp = /<b>\s*(?:<a.+?>)?(.*?)(?:<\/[ab]>)+(\[.*?])\s*<br>\s*(De : .*)?.*<br>/;
        const description_match = (<HTMLElement>itemElem)?.innerHTML?.match(debug_regex);
        description = 
            util.defaulted(description_match?.[1], '').trim() + ' ' 
            + util.defaulted(description_match?.[3], '').trim() + ' '
            + util.defaulted(description_match?.[2], '').trim();
        debug_regex =  /Qty: | Qté\s:\s(\d+)/;
        const qty_match = (<HTMLElement>itemElem)?.textContent?.match(debug_regex);
        const sqty = qty_match ? qty_match[1] : '1';
        qty = parseInt(sqty);
        const price_match = (<HTMLElement>itemElem)?.nextElementSibling?.textContent?.match(util.moneyRegEx());
        price = price_match ? price_match[1] : '';
        return {
            description: description,
            order_date: order_date,
            order_detail_url: order_detail_url,
            order_id: order_id,
            price: price,
            quantity: qty,
            url: url,
        } 
    });
    return items;
}

// TODO  Add logging/counting of how frequently each strategy "wins",
// TODO  and then prune/merge/improve.

// Amazon.com 2016
function strategy2(
    order_id: string,
    order_date: string,
    order_detail_url: string,
    order_elem: HTMLElement,
    context: string,
): IItem[] {
    const itemElems: Node[] = util.findMultipleNodeValues(
        '//div[contains(@id, "orderDetails")]//a[contains(@href, "/product/")]/parent::*',
        order_elem
    );
    const items: IItem[] = <IItem[]>itemElems.map( itemElem => {
        const link = <HTMLElement>util.findSingleNodeValue(
            './/a[contains(@href, "/product/")]',
            <HTMLElement>itemElem,
            context,
        );
        const description = util.defaulted(link.textContent, '').trim();
        const url = util.defaulted(link.getAttribute('href'), '').trim();
        const qty_match = link.parentNode
                             ?.parentNode
                             ?.textContent
                             ?.match(/Qty: (\d+)/);
        const sqty = qty_match ? qty_match[1] : '1';
        const qty = parseInt(sqty);
        const price_match = link.parentNode
                               ?.parentNode
                               ?.nextSibling
                               ?.nextSibling
                               ?.textContent
                               ?.match(util.moneyRegEx())
        const price = price_match ? price_match[1] : '';
        return {
            description: description,
            order_date: order_date,
            order_detail_url: order_detail_url,
            order_id: order_id,
            price: price,
            quantity: qty,
            url: url,
        } 
    });
    return items.filter( item => item.description != '' );
}

// This strategy works for Amazon.com grocery orders in 2021.
function strategy3(
    order_id: string,
    order_date: string,
    order_detail_url: string,
    order_elem: HTMLElement,
    context: string,
): IItem[] {
    const itemElems: Node[] = util.findMultipleNodeValues(
        '//div[contains(@class, "a-section")]//span[contains(@id, "item-total-price")]/parent::div/parent::div/parent::div',
        order_elem
    );
    const items: IItem[] = <IItem[]>itemElems.map( itemElem => {
        const link = <HTMLElement>util.findSingleNodeValue(
            './/a[contains(@class, "a-link-normal") and contains(@href, "/product/")]',
            <HTMLElement>itemElem,
            context,
        );
        const description = util.defaulted(link.textContent, '').trim();
        const url = util.defaulted(link.getAttribute('href'), '').trim();
        const sqty = link.parentNode?.nextSibling?.textContent?.trim() ?? "1";
        const qty = parseInt(sqty);
        let price = '';
        try {
            const priceElem = <HTMLElement>util.findSingleNodeValue(
                './/span[contains(@id, "item-total-price")]',
                <HTMLElement>itemElem,
                context,
            );
            price = util.defaulted(priceElem.textContent, '').trim();
        } catch(ex) {
            console.warn('could not find price for: ' + description);
        }
        return {
            description: description,
            order_date: order_date,
            order_detail_url: order_detail_url,
            order_id: order_id,
            price: price,
            quantity: qty,
            url: url,
        } 
    });
    return items;
}
