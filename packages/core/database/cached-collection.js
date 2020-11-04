import Indexer from "./indexer";
import sort from "fast-sort";
import { EV } from "../common";

export default class CachedCollection {
  constructor(context, type) {
    this.map = new Map();
    this.indexer = new Indexer(context, type);
  }

  async init() {
    await this.indexer.init();
    const data = await this.indexer.readMulti(this.indexer.indices);
    if (data.length > 0) this.map = new Map(data);
  }

  async clear() {
    this.map.clear();
    await this.indexer.clear();
  }

  async addItem(item) {
    if (!item.id) throw new Error("The item must contain the id field.");

    let exists = this.map.has(item.id);
    if (!exists) {
      item.dateCreated = item.dateCreated || Date.now();
    }
    await this.updateItem(item);
    if (!exists) {
      await this.indexer.index(item.id);
    }
  }

  async updateItem(item) {
    if (!item.id) throw new Error("The item must contain the id field.");
    // if item is newly synced, remote will be true.
    item.dateEdited = item.remote ? item.dateEdited : Date.now();
    // the item has become local now, so remove the flag.
    delete item.remote;
    this.map.set(item.id, item);
    await this.indexer.write(item.id, item);

    EV.publish("db:write", item);
  }

  removeItem(id) {
    const deletedItem = {
      id,
      deleted: true,
      dateEdited: Date.now(),
      dateCreated: Date.now(),
    };
    return this.updateItem(deletedItem);
  }

  exists(id) {
    return this.map.has(id) && !this.map.get(id).deleted;
  }

  getItem(id) {
    return this.map.get(id);
  }

  getRaw() {
    return Array.from(this.map.values());
  }

  getAllItems(sortFn = (u) => u.dateCreated) {
    let items = [];
    this.map.forEach((value) => {
      if (!value || value.deleted) return;
      items[items.length] = value;
    });
    return sort(items).desc(sortFn);
  }
}
