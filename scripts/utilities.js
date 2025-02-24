// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: Copyright 2025 Daniel Evers

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'path'
import deepmerge from 'deepmerge'
import yaml from 'yaml'

function isScalar(value) {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null
}

export class BactwinDefinitions {

    rootpath
    properties
    objects

    async read(rootpath = join(`${import.meta.dirname}/..`)) {
        this.rootpath = rootpath
        const properties = await this.#readScope('properties')
        this.properties = this.#expandScope(properties)
        const objects = await this.#readScope('objects')
        this.#normalizeObjects(objects.bases)
        this.#normalizeObjects(objects.items)
        this.objects = this.#expandScope(objects)
        for (const object of Object.values(this.objects)) {
            for (const [name, property] of Object.entries(object.properties || {})) {
                object.properties[name] = deepmerge(this.properties[name], property)
            }
        }
    }

    async save() {
        await writeFile(join(this.rootpath, `compilation/properties.json`), JSON.stringify(this.properties, null, 4))

        let objects = {}
        Object.entries(this.objects).sort((a, b) => {
            if (a[1].order < b[1].order) {
                return -1;
            }
            if (a[1].order > b[1].order) {
                return 1;
            }
            return 0;
        }).forEach(([name, object]) => objects[name] = object)
        await writeFile(join(this.rootpath, `compilation/objects.json`), JSON.stringify(objects, null, 4))
    }

    #normalizeObjects(objects) {
        for (const object of Object.values(objects)) {
            for (const [name, property] of Object.entries(object.properties || {})) {
                if (isScalar(property)) {
                    object.properties[name] = { content: property }
                }
            }
        }
    }

    #expandBase(name, definition, sourceBases, expandedBases) {
        if (expandedBases.has(name)) {
            return expandedBases.get(name)
        }
        const base = definition.base
        let expandedBase = expandedBases.get(name)
        if (!expandedBase) {
            if (sourceBases.has(base)) {
                expandedBase = this.#expandBase(base, sourceBases.get(base), sourceBases, expandedBases)
            }
            else if (name === 'default' && base === null) {
                expandedBase = {}
            }
            else {
                throw new Error(`Unknown base: ${base}`)
            }
        }
        const expansion = deepmerge(expandedBase, definition)
        expandedBases.set(name, expansion)
        return expansion
    }

    #expandScope(scope) {
        let expandedBases = new Map()
        let sourceBases = new Map(Object.entries(scope.bases))
        for (const [name, definition] of Object.entries(scope.bases)) {
            this.#expandBase(name, definition, sourceBases, expandedBases)
        }
        let items = {}
        for (const [name, definition] of Object.entries(scope.items)) {
            const base = expandedBases.get(definition.base)
            if (base === undefined) {
                throw new Error(`Unknown base: ${name}, ${definition.base}`)
            }
            const item = deepmerge(base, definition)
            items[name] = item
        }
        return items
    }

    async #readScope(scope) {
        let items = {}
        const dirpath = join(this.rootpath, scope)
        const files = await readdir(dirpath)
        for (const file of files.sort()) {
            if (file.endsWith('.yaml')) {
                const filepath = join(dirpath, file)
                const content = await readFile(filepath, 'utf-8')
                const item = yaml.parse(content)
                const name = file.slice(0, -5)
                items[name] = item
            }
        }
        if (scope.endsWith('bases')) {
            return items
        }
        const bases = await this.#readScope(`${scope}/bases`)
        return { bases, items }
    }

}