import { mainPage } from "../../support/page_objects/mainPage";
import {
    isTestSuiteActive,
    isXcdb,
} from "../../support/page_objects/projectConstants";

export const genTest = (apiType, dbType) => {
    if (!isTestSuiteActive(apiType, dbType)) return;

    describe(`${apiType.toUpperCase()} api - DURATION`, () => {
        // to retrieve few v-input nodes from their label
        //
        const fetchParentFromLabel = (label) => {
            cy.get("label").contains(label).parents(".v-input").click();
        };

        // Run once before test- create project
        //
        before(() => {
            mainPage.tabReset();
            // open a table to work on views
            //
            cy.openTableTab("City", 25);
        });

        after(() => {
            cy.closeTableTab("City");
        });

        // Routine to create a new look up column
        //
        const addDurationColumn = (columnName, durationFormat) => {
            // (+) icon at end of column header (to add a new column)
            // opens up a pop up window
            //
            cy.get(".new-column-header").click();

            // Column name
            cy.get(".nc-column-name-input input").clear().type(`${columnName}`);

            // Column data type
            cy.get(".nc-ui-dt-dropdown").click();
            cy.getActiveMenu().contains("Duration").click();

            // Configure Child table & column names
            fetchParentFromLabel("Duration Format");
            cy.getActiveMenu().contains(durationFormat).click();

            cy.snipActiveMenu("Duration");

            // click on Save
            cy.get(".nc-col-create-or-edit-card").contains("Save").click();

            // Verify if column exists.
            //
            cy.get(`th:contains(${columnName})`).should("exist");
        };

        // routine to delete column
        //
        const deleteColumnByName = (columnName) => {
            // verify if column exists before delete
            cy.get(`th:contains(${columnName})`).should("exist");

            // delete opiton visible on mouse-over
            cy.get(`th:contains(${columnName}) .mdi-menu-down`)
                .trigger("mouseover")
                .click();

            // delete/ confirm on pop-up
            cy.get(".nc-column-delete").click();
            cy.getActiveModal().find("button:contains(Confirm)").click();

            // validate if deleted (column shouldnt exist)
            cy.get(`th:contains(${columnName})`).should("not.exist");
        };

        // routine to edit column
        //
        const editColumnByName = (oldName, newName, newDurationFormat) => {
            // verify if column exists before delete
            cy.get(`th:contains(${oldName})`).should("exist");

            // delete opiton visible on mouse-over
            cy.get(`th:contains(${oldName}) .mdi-menu-down`)
                .trigger("mouseover")
                .click();

            // edit/ save on pop-up
            cy.get(".nc-column-edit").click();
            cy.get(".nc-column-name-input input").clear().type(newName);

            // Configure Child table & column names
            fetchParentFromLabel("Duration Format");
            cy.getActiveMenu().contains(newDurationFormat).click();

            cy.snipActiveMenu("Duration");

            cy.get(".nc-col-create-or-edit-card")
                .contains("Save")
                .click({ force: true });

            cy.toastWait("Formula column updated successfully");

            // validate if deleted (column shouldnt exist)

            // FIXME: 
            // Expected <th.grey-border.caption.font-wight-regular.nc-grid-header-cell.grey.lighten-4.grey--text.text--darken-2> not to exist in the DOM, but it was continuously found.
            cy.get(`th:contains(${oldName})`).should("not.exist");
            cy.get(`th:contains(${newName})`).should("exist");
        };

        ///////////////////////////////////////////////////
        // Test case

        it("Duration: h:mm", () => {
            addDurationColumn("NC_DURATION_0", "h:mm (e.g. 1:23)");
            // TODO: validate
        });

        it("Duration: h:mm:ss", () => {
            addDurationColumn("NC_DURATION_1", "h:mm:ss (e.g. 3:45, 1:23:40)");
            // TODO: validate
        });

        it("Duration: h:mm:ss.s", () => {
            addDurationColumn("NC_DURATION_2", "h:mm:ss.s (e.g. 3:34.6, 1:23:40.0)");
            // TODO: validate
        });

        it("Duration: h:mm:ss.ss", () => {
            addDurationColumn("NC_DURATION_3", "h:mm:ss.ss (e.g. 3.45.67, 1:23:40.00)");
            // TODO: validate
        });

        it("Duration: h:mm:ss.sss", () => {
            addDurationColumn("NC_DURATION_4", "h:mm:ss.sss (e.g. 3.45.678, 1:23:40.000)");
            // TODO: validate
        });

        // Update Duration column name with a new format (type_idx + 1 % 5) 

        it("Duration: Edit Column NC_DURATION_0", () => {
            editColumnByName(
                "NC_DURATION_0",
                "NC_DURATION_0_EDITED",
                "h:mm:ss (e.g. 3:45, 1:23:40)"
            );
            // TODO: validate
        });

        it("Duration: Edit Column NC_DURATION_1", () => {
            editColumnByName(
                "NC_DURATION_1",
                "NC_DURATION_1_EDITED",
                "h:mm:ss.s (e.g. 3:34.6, 1:23:40.0)"
            );
            // TODO: validate
        });

        it("Duration: Edit Column NC_DURATION_2", () => {
            editColumnByName(
                "NC_DURATION_2",
                "NC_DURATION_2_EDITED",
                "h:mm:ss (e.g. 3:45, 1:23:40)"
            );
            // TODO: validate
        });

        it("Duration: Edit Column NC_DURATION_3", () => {
            editColumnByName(
                "NC_DURATION_3",
                "NC_DURATION_3_EDITED",
                "h:mm:ss.ss (e.g. 3.45.67, 1:23:40.00)"
            );
            // TODO: validate
        });

        it("Duration: Edit Column NC_DURATION_4", () => {
            editColumnByName(
                "NC_DURATION_4",
                "NC_DURATION_4_EDITED",
                "h:mm (e.g. 1:23)"
            );
            // TODO: validate
        });

        it("Duration: Delete column", () => {
            deleteColumnByName("NC_DURATION_0_EDITED");
            deleteColumnByName("NC_DURATION_1_EDITED");
            deleteColumnByName("NC_DURATION_2_EDITED");
            deleteColumnByName("NC_DURATION_3_EDITED");
            deleteColumnByName("NC_DURATION_4_EDITED");
        });

        it("Duration: Add data with h:mm", () => {
            // TODO:
        });

        it("Duration: Add data with h:mm:ss", () => {
            // TODO:
        });

        it("Duration: Add data with h:mm:ss.s", () => {
            // TODO:
        });

        it("Duration: Add data with h:mm:ss.ss", () => {
            // TODO:
        });

        it("Duration: Add data with h:mm:ss.sss", () => {
            // TODO:
        });

        // TODO: Change format to verify the data
        // ...
    });
};

/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Wing-Kam Wong <wingkwong.code@gmail.com>
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
