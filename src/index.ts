import { Plugin } from "siyuan";

import "./index.scss";

/**
 * Plugin lifecycle composition root.
 *
 * Task-card and task-center capabilities will be registered here in later
 * independently verifiable stages.
 */
export default class TickTickTaskCenterPlugin extends Plugin {
    onload(): void {
        // Intentionally minimal during project initialization.
    }

    onunload(): void {
        // Future DOM enhancement cleanup will be registered here.
    }
}
