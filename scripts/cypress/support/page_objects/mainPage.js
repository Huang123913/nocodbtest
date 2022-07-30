import { projectsPage } from "./navigation";

const path = require("path");

/**
 * Delete the downloads folder to make sure the test has "clean"
 * slate before starting.
 */
export const deleteDownloadsFolder = () => {
    const downloadsFolder = Cypress.config("downloadsFolder");
    cy.task("deleteFolder", downloadsFolder);
};

export class _settingsPage {
    constructor() {
        // menu
        this.TEAM_N_AUTH = "teamAndAuth";
        this.APPSTORE = "appStore";
        this.PROJ_METADATA = "metaData";
        this.AUDIT = "audit";

        // submenu
        this.USER_MANAGEMENT = "usersManagement";
        this.API_TOKEN_MANAGEMENT = "apiTokenManagement";
        this.APPS = "new";
        this.METADATA = "metaData";
        this.UI_ACCESS_CONTROL = "acl";
        this.AUDIT_LOG = "audit";
    }

    openMenu(menuId) {
        // open settings tab
        cy.get('.nc-team-settings').should('exist').click()
        cy.get(`[data-menu-id=${menuId}]`).should('exist').click()
    }

    openTab(tabId) {
        cy.get(`[data-menu-id=${tabId}]`).should('exist').last().click()
    }

    closeMenu() {
        cy.getActiveModal().find('.ant-modal-close-x').click({ force: true });
    }
}

// main page
export class _mainPage {
    constructor() {

        // Top Left items
        this.HOME = 0;

        this.AUDIT = 0;
        this.APPSTORE = 2;
        this.TEAM_N_AUTH = 3;
        this.PROJ_METADATA = 4;
        this.ROLE_VIEW = 5;
        this.ROLE_VIEW_EDITOR = 6;
        this.ROLE_VIEW_COMMENTER = 7;
        this.ROLE_VIEW_VIEWER = 8;
        this.ROLE_VIEW_RESET = 9;

        this.roleURL = {};
    }

    toolBarTopLeft(toolBarItem) {
        return cy
            .get("header.v-toolbar", { timeout: 20000 })
            .eq(0)
            .find("a")
            .eq(toolBarItem);
    }

    toolBarTopRight(toolBarItem) {
        return cy
            .get("header.v-toolbar", { timeout: 20000 })
            .eq(0)
            .find("button")
            .eq(toolBarItem);
    }

    navigationDraw(item) {
        // open settings tab
        cy.get(".nc-team-settings").should("exist").click();
        // if (item == this.ROLE_VIEW)
        //     return cy.get('.nc-nav-drawer').find('.v-list').last()
        // else
        //     return cy.get('.nc-nav-drawer').find('.v-list > .v-list-item').eq(item)

        switch (item) {
            case this.AUDIT:
                return cy.get(".nc-settings-audit:visible").should("exist");
            case this.APPSTORE:
                return cy.get(".nc-settings-appstore:visible").should("exist");
            case this.TEAM_N_AUTH:
                return cy.get(".nc-settings-teamauth:visible").should("exist");
            case this.PROJ_METADATA:
                return cy.get(".nc-settings-projmeta:visible").should("exist");
            case this.ROLE_VIEW_EDITOR:
                return cy.get(".nc-preview-editor:visible").should("exist");
            case this.ROLE_VIEW_COMMENTER:
                return cy.get(".nc-preview-commenter:visible").should("exist");
            case this.ROLE_VIEW_VIEWER:
                return cy.get(".nc-preview-viewer:visible").should("exist");
            case this.ROLE_VIEW_RESET:
                return cy.get(".nc-preview-reset:visible").should("exist");
        }
    }

    // add new user to specified role
    //
    addNewUserToProject = (userCred, roleType) => {
        let linkText;

        // click on New User button, feed details
        cy.get('button:contains("New User")').first().click();

        cy.snip("NewUser");

        cy.get('label:contains("E-mail")')
            .next("input")
            .type(userCred.username)
            .trigger("input");

        cy.get('label:contains("Select User Role")').click();

        // opt-in requested role & submit
        cy.snipActiveMenu("Menu_RoleType");
        cy.getActiveMenu().contains(roleType).click();
        cy.get(".nc-invite-or-save-btn").click();

        cy.toastWait("Successfully updated the user details");

        // get URL, invoke
        cy.snipActiveModal("Modal_NewUserURL");
        cy.getActiveModal()
            .find(".v-alert")
            .then(($obj) => {
                linkText = $obj.text().trim();
                cy.log(linkText);
                this.roleURL[roleType] = linkText;

                cy.get("body").click("right");
            });
    };

    addExistingUserToProject = (emailId, role) => {
        cy.get('.v-list-item:contains("Team & Auth")').click();
        cy.get(`tr:contains(${emailId})`)
            .find(".mdi-plus", { timeout: 2000 })
            .click();
        cy.get(`tr:contains(${emailId})`)
            .find(".mdi-pencil-outline", { timeout: 2000 })
            .click();

        cy.get("label:contains(Select User Role)").click();

        // opt-in requested role & submit
        //
        cy.getActiveMenu().contains(role).click();
        cy.get(".nc-invite-or-save-btn").click();
        cy.toastWait("Successfully updated the user details");

        this.roleURL[role] =
            "http://localhost:3000/#/user/authentication/signin";
    };

    getCell = (columnHeader, cellNumber) => {
        return cy.get(
            `tbody > :nth-child(${cellNumber}) > [data-col="${columnHeader}"]`
        );
    };

    getPagination = (pageNumber) => {
        if (pageNumber == "<")
            return cy.get(".nc-pagination .v-pagination > li:first-child");
        if (pageNumber == ">")
            return cy.get(".nc-pagination .v-pagination > li:last-child");

        return cy.get(
            `.nc-pagination .v-pagination > li:contains(${pageNumber}) button`
        );
    };

    getRow = (rowIndex) => {
        return cy.get(".xc-row-table").find("tr").eq(rowIndex);
    };

    addColumn = (colName, tableName) => {
        cy.get(".v-window-item--active .nc-grid  tr > th:last button").click({
            force: true,
        });
        cy.get(".nc-column-name-input input", { timeout: 3000 })
            .clear()
            .type(colName);
        cy.get(".nc-col-create-or-edit-card").contains("Save").click();
        cy.toastWait(`Update table successful`);
    };

    addColumnWithType = (colName, colType, tableName) => {
        cy.get(".v-window-item--active .nc-grid  tr > th:last button").click({
            force: true,
        });
        cy.get(".nc-column-name-input input", { timeout: 3000 })
            .clear()
            .type(colName);

        // Column data type: to be set to lookup in this context
        cy.get(".nc-ui-dt-dropdown").click();
        cy.getActiveMenu().contains(colType).click();

        cy.get(".nc-col-create-or-edit-card").contains("Save").click();
        cy.toastWait(`Update table successful`);
    };

    deleteColumn = (colName) => {
        cy.get(`th:contains(${colName}) .mdi-menu-down`)
            .trigger("mouseover")
            .click();

        cy.get(".nc-column-delete", { timeout: 5000 }).click();
        cy.get("button:contains(Confirm)").click();
    };

    getAuthToken = () => {
        let obj = JSON.parse(localStorage["vuex"]);
        return obj["users"]["token"];
    };

    configureSMTP = (from, host, port, secure) => {
        cy.getActiveModal().find('.nc-app-store-card-SMTP').click().then((obj) => {
            cy.wrap(obj).find('.nc-app-store-card-install').click({ force: true });
        })

        cy.getActiveModal().find('#form_item_from').should('exist').clear().type(from)
        cy.getActiveModal().find('#form_item_host').should('exist').clear().type(host)
        cy.getActiveModal().find('#form_item_port').should('exist').clear().type(port)
        cy.getActiveModal().find('#form_item_secure').should('exist').clear().type(secure)
        cy.getActiveModal().find("button").contains("Save").click();

        cy.toastWait('Successfully installed and email notification will use SMTP configuration');
    };

    resetSMTP = () => {
        cy.getActiveModal().find('.nc-app-store-card-SMTP').click().then((obj) => {
            cy.wrap(obj).find('.nc-app-store-card-reset').click({ force: true });
        })
        cy.getActiveModal().find("button").contains("Confirm").click();

        cy.toastWait("Plugin uninstalled successfully");
    };

    shareView = () => {
        cy.wait(3000);
        return cy.get(".nc-btn-share-view");
    };

    shareViewList = () => {
        cy.get(".nc-actions-menu-btn").click();
        return cy.getActiveMenu().find('[role="menuitem"]').eq(2);
    };

    downloadCsv = () => {
        cy.get(".nc-actions-menu-btn").click();
        return cy.getActiveMenu().find('[role="menuitem"]').eq(0);
    };

    uploadCsv = () => {
        cy.get(".nc-actions-menu-btn").click();
        return cy.getActiveMenu().find('[role="menuitem"]').eq(1);
    };

    automations = () => {
        cy.get(".nc-actions-menu-btn").click();
        return cy.getActiveMenu().find('[role="menuitem"]').eq(3);
    };

    hideField = (field) => {
        cy.get(".nc-grid-header-cell").contains(field).should("be.visible");
        cy.get(".nc-fields-menu-btn").click();
        cy.getActiveMenu().find(`.nc-fields-list label:contains(${field}):visible`).click();
        cy.get(".nc-fields-menu-btn").click();
        cy.get(".nc-grid-header-cell").contains(field).should("not.be.visible");
    };

    unhideField = (field) => {
        cy.get(".nc-grid-header-cell").contains(field).should("not.be.visible");
        cy.get(".nc-fields-menu-btn").click();
        cy.getActiveMenu().find(`.nc-fields-list label:contains(${field}):visible`).click();
        cy.get(".nc-fields-menu-btn").click();
        cy.get(".nc-grid-header-cell").contains(field).should("be.visible");
    };

    sortField = (field, criteria) => {
        cy.get(".nc-sort-menu-btn").click();
        cy.getActiveMenu().contains("Add Sort Option").click();
        // cy.get(".nc-sort-field-select div").first().click().type(field);
        cy.get(".nc-sort-field-select div").first().click();
        cy.get('.ant-select-dropdown').find(`.ant-select-item`).contains(field).should('exist').click();
        cy.get(".nc-sort-dir-select div").first().click();
        cy.get('.ant-select-dropdown').find(`.ant-select-item`).contains(criteria).should('exist').click();
        cy.get(".nc-sort-menu-btn").click();
    };

    clearSort = () => {
        cy.get(".nc-sort-menu-btn").click();
        cy.get(".nc-sort-item-remove-btn").click();
        cy.get(".nc-sort-menu-btn").click();
    };

    filterField = (field, operation, value) => {
        cy.get(".nc-filter-menu-btn").click();
        cy.contains("Add Filter").click();
        // cy.get(".nc-filter-field-select").should("exist").last().click().type(field);
        cy.get(".nc-filter-field-select").should("exist").last().click();
        cy.get('.ant-select-dropdown').find(`.ant-select-item`).contains(field).should('exist').click();
        cy.wait(1000);
        cy.get(".nc-filter-operation-select").should("exist").last().click();
        cy.get('.ant-select-dropdown').find(`.ant-select-item`).contains(operation).should('exist').click();
        if (operation != "is null" && operation != "is not null") {
            cy.get(".nc-filter-value-select")
                .should("exist")
                .last()
                .type(value);
            cy.get(".nc-filter-operation-select").last().click();
        }
        cy.get(".nc-filter-menu-btn").click();
    };

    filterReset = () => {
        cy.get(".nc-filter-menu-btn").click();
        cy.get(".nc-filter-item-remove-btn").click();
        cy.get(".nc-filter-menu-btn").click();
    };

    // delete created views
    //
    deleteCreatedViews = () => {
        // cy.get(".v-navigation-drawer__content > .container")
        //   .find(".v-list > .v-list-item")
        //   .contains("Share View")
        //   .parent()
        //   .find("button.mdi-dots-vertical")
        //   .click();

        // cy.getActiveMenu().find(".v-list-item").contains("Views List").click();
        this.shareViewList().click();

        cy.snipActiveModal("Modal_ShareViewList");

        cy.wait(1000);

        // cy.get('.container').find('button.mdi-delete-outline')

        cy.get('th:contains("View Link")')
            .should("exist")
            .parent()
            .parent()
            .next()
            .find("tr")
            .each(($tableRow) => {
                cy.log($tableRow[0].childElementCount);

                // one of the row would contain seggregation header ('other views)
                if (4 == $tableRow[0].childElementCount) {
                    cy.wrap($tableRow).find("button").last().click();
                    cy.wait(1000);
                }
            })
            .then(() => {
                cy.toastWait("Deleted shared view successfully");
                // close modal
                cy.get(".v-overlay--active > .v-overlay__scrim").click({
                    force: true,
                });
            });
    };

    // download CSV & verify
    // download folder is configurable in cypress.
    //      trigger download
    //      wait for a while & check in configured download folder for the intended file
    //      if it exists, verify it against 'expectedRecords' passed in as parameter
    //
    downloadAndVerifyCsv = (filename, verifyCsv) => {
        cy.get(".nc-actions-menu-btn").click();
        cy.snipActiveMenu("Menu_ActionsMenu");
        cy.get(
            `.menuable__content__active .v-list-item span:contains("Download as CSV")`
        ).click();

        cy.toastWait("Successfully exported all table data").then(() => {
            // download folder path, read from config file
            const downloadsFolder = Cypress.config("downloadsFolder");
            let filePath = path.join(downloadsFolder, filename);

            // append download folder path with filename to generate full file path, retrieve file
            cy.readFile(filePath).then((fileData) => {
                // from CSV, split into records (rows)
                const rows = fileData.replace(/\r\n/g, "\n").split("\n");
                verifyCsv(rows);
                deleteDownloadsFolder();
            });
        });
    };

    getIFrameCell = (columnHeader, cellNumber) => {
        return cy
            .iframe()
            .find(
                `tbody > :nth-child(${cellNumber}) > [data-col="${columnHeader}"]`
            );
    };

    // https://docs.cypress.io/guides/core-concepts/variables-and-aliases#Sharing-Context
    getDatatype = (tableName, columnName) => {
        cy.window().then((win) => {
            const col = win.$nuxt.$store.state.meta.metas[tableName].columns;
            let dataType = "";
            col.forEach((element) => {
                if (element.cn == columnName) dataType = element.uidt;
            });
            cy.wrap(dataType).as("ncDatatype");
        });
    };

    openMetaTab() {
        // open Project metadata tab
        //
        settingsPage.openMenu(settingsPage.PROJ_METADATA)
        settingsPage.openTab(settingsPage.METADATA)
    }

    closeMetaTab() {
        // close Project metadata tab
        settingsPage.closeMenu()

        // refresh
        cy.refreshTableTab();
    }

    metaSyncValidate(tbl, msg) {
        cy.get(".nc-btn-metasync-reload")
            .should("exist")
            .click({ force: true });
        cy.get(`.nc-metasync-row-${tbl}`).contains(msg).should("exist");
        cy.get(".nc-btn-metasync-sync-now")
            .should("exist")
            .click({ force: true })
            .then(() => {
                cy.toastWait(`Table metadata recreated successfully`);
            });
        cy.get(".nc-metasync-row").then((row) => {
            for (let i = 0; i < row.length; i++) {
                cy.wrap(row).contains("No change identified").should("exist");
            }
        });
    }

    tabReset() {
        // temporary disable (kludge)
        // mainPage.toolBarTopLeft(mainPage.HOME).click({ force: true });
        // cy.get(".project-row").should("exist").click({ force: true });
        // projectsPage.waitHomePageLoad();
        // option-2
        // cy.openTableTab("Country", 0);
        // cy.get(".mdi-close").click({ multiple: true });
    }
}

export const mainPage = new _mainPage();
export const settingsPage = new _settingsPage();

/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Raju Udava <sivadstala@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
