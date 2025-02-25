// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: Copyright 2025 Daniel Evers

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'path'
import deepmerge from 'deepmerge'
import yaml from 'yaml'

/**
 * Checks whether a value is a scalar (non-object).
 * 
 * This function determines if the provided value is a scalar type, which includes
 * strings, numbers, booleans, or null.
 * 
 * @param {*} value - The value to check.
 * @returns {boolean} - Returns true if the value is a scalar, otherwise false.
 */
function isScalar(value) {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null
}

export class BactwinDefinitions {

    /**
     * The locale to be used for reading definitions.
     * @type {string}
     */
    locale

    /**
     * The root path where the scoped definitions are stored.
     * @type {string}
     */
    rootpath

    /**
     * A map of properties definitions.
     * @type {Map}
     */
    properties

    /**
     * A map of object definitions.
     * @type {Map}
     */
    objects

    /**
     * Normalizes the properties of object definitions in the provided map.
     * 
     * This function iterates over each object definition in the map and ensures that
     * scalar properties (strings, numbers, booleans, or null) are wrapped in an object
     * with a `content` key. This normalization helps maintain a consistent structure
     * for properties, simplifying further processing.
     * 
     * @param {Map} map - A map containing object definitions.
     */
    #normalizeObjects(map) {
        map.forEach(definition => {
            for (const [name, property] of Object.entries(definition.properties || {})) {
                if (isScalar(property)) {
                    definition.properties[name] = { content: property }
                }
            }
        })
    }

    /**
     * Reads and parses YAML files from the specified scope directory.
     * 
     * This function reads all YAML files in the given scope directory, parses their content,
     * and stores the resulting objects in a map. It recursively reads the 'bases' subdirectory
     * and returns an object containing both the bases and items maps.
     * 
     * @param {string} scope - The directory path relative to the root path to read the YAML
     * files from.
     * @returns {Promise<Map|string>} - A promise that resolves to a map of parsed objects or
     * an object containing bases and items maps.
     */
    async #readScope(scope) {
        let items = new Map()
        const dirpath = join(this.rootpath, scope)
        const files = await readdir(dirpath)
        for (const file of files.sort()) {
            if (file.endsWith('.yaml')) {
                const filepath = join(dirpath, file)
                const content = await readFile(filepath, 'utf-8')
                const item = yaml.parse(content)
                const name = file.slice(0, -5)
                items.set(name, item || {})
            }
        }
        if (scope.endsWith('bases')) {
            return items
        }
        const bases = await this.#readScope(`${scope}/bases`)
        return { bases, items }
    }

    /**
     * Merges a base definition with its localized and specific definitions.
     * 
     * This function retrieves the localized definition for the given name from the map,
     * merges it with the provided definition, and then merges the result with the base
     * definition. The final merged object is returned.
     * 
     * @param {string} name - The name of the definition.
     * @param {Object} base - The base definition object.
     * @param {Object} definition - The specific definition object.
     * @param {Map} map - A map containing all definitions, including localized ones.
     * @returns {Object} - The merged definition object.
     */
    #merge(name, base, definition, map) {
        const localeDefinition = map.get(`${name}.${this.locale}`)
        const localization = localeDefinition ? deepmerge(definition, localeDefinition) : definition
        const expansion = deepmerge(base, localization)
        return expansion
    }

    /**
     * Expands a base definition by recursively merging it with its parent bases.
     * 
     * This function takes a base definition and recursively merges it with its parent bases
     * from the sourceBases map. It ensures that all inherited properties are included in the
     * final expanded base. If the base is not found in the sourceBases map, an error is thrown.
     * 
     * @param {string} name - The name of the base definition.
     * @param {Object} definition - The base definition object.
     * @param {Map} sourceBases - A map containing all base definitions.
     * @param {Map} expandedBases - A map to store the expanded base definitions.
     * @returns {Object} - The expanded base definition object.
     */
    #expandBase(name, definition, sourceBases, expandedBases) {
        if (!name.match(/^[-0-9a-z]+$/)) {
            return
        }
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
        const expansion = this.#merge(name, expandedBase, definition, sourceBases)
        expandedBases.set(name, expansion)
        return expansion
    }

    /**
     * Expands all base definitions and merges them with their specific definitions.
     * 
     * This function iterates over all base definitions in the provided scope, expands them
     * by recursively merging them with their parent bases, and then merges the expanded bases
     * with their specific definitions. It ensures that all inherited properties are included
     * in the final expanded definitions. If a base is not found, an error is thrown.
     * 
     * @param {Object} scope - The scope containing bases and items to be expanded.
     * @returns {Object} - An object containing the expanded items.
     */
    #expandScope(scope) {
        let expandedBases = new Map()
        scope.bases.forEach((definition, name) => this.#expandBase(name, definition, scope.bases, expandedBases))
        let items = {}
        scope.items.forEach((definition, name) => {
            const base = expandedBases.get(definition.base)
            if (base === undefined) {
                throw new Error(`Unknown base: ${definition.base} in ${name}`)
            }
            const item = this.#merge(name, base, definition, scope.items)
            items[name] = item
        })
        return items
    }

    /**
     * Reads and processes definitions for the specified locale and root path.
     * 
     * This function sets the locale and root path, reads the properties and objects
     * definitions from their respective directories, normalizes the object definitions,
     * expands the base definitions, and merges the properties into the objects.
     * 
     * @param {string} [locale='de'] - The locale to be used for reading definitions.
     * @param {string} [rootpath=join(`${import.meta.dirname}/..`)] - The root path where the definitions are stored.
     * @returns {Promise<void>} - A promise that resolves when the definitions have been read and processed.
     */
    async read(locale = 'de', rootpath = join(`${import.meta.dirname}/..`)) {
        this.locale = locale
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

    /**
     * Saves the processed definitions to JSON files.
     * 
     * This function writes the properties and objects definitions to JSON files in the
     * 'compilation' directory. The objects are sorted by their 'order' property before
     * being written to the file.
     * 
     * @returns {Promise<void>} - A promise that resolves when the definitions have been saved.
     */
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

}