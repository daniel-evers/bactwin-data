// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: Copyright 2025 Daniel Evers

import { BactwinDefinitions } from './utilities.js'

const definitions = new BactwinDefinitions()
await definitions.read()
await definitions.save()