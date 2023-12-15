import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import { GridPage } from '../../../pages/Dashboard/Grid';
import setup, { unsetup } from '../../../setup';
import { TopbarPage } from '../../../pages/Dashboard/common/Topbar';
import { ToolbarPage } from '../../../pages/Dashboard/common/Toolbar';

const users: string[] = [
  'user@nocodb.com',
  'user-0@nocodb.com',
  'user-1@nocodb.com',
  'user-2@nocodb.com',
  'user-3@nocodb.com',
];

test.describe('User single select', () => {
  let dashboard: DashboardPage, grid: GridPage, topbar: TopbarPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);
    grid = dashboard.grid;
    topbar = dashboard.grid.topbar;

    await dashboard.treeView.createTable({ title: 'Sheet1', baseTitle: context.base.title });

    await grid.column.create({ title: 'User', type: 'User' });

    await grid.addNewRow({ index: 0, value: 'Row 0' });
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Verify the default option count, select default value and verify', async () => {
    await grid.column.userOption.verifyDefaultValueOptionCount({ columnTitle: 'User', totalCount: 5 });

    await grid.column.userOption.selectDefaultValueOption({
      columnTitle: 'User',
      option: users[0],
      multiSelect: false,
    });

    // Verify default value is set
    await grid.column.userOption.verifySelectedOptions({
      columnHeader: 'User',
      options: [users[0]],
    });

    // Add new row and verify default value is added in new cell
    await grid.addNewRow({ index: 1, value: 'Row 1' });
    await grid.cell.userOption.verify({
      index: 1,
      columnHeader: 'User',
      option: users[0],
      multiSelect: false,
    });
  });

  test('Rename column title and delete the column', async () => {
    // Rename column title, reload page and verify
    await grid.column.openEdit({ title: 'User' });
    await grid.column.fillTitle({ title: 'UserField' });
    await grid.column.save({
      isUpdated: true,
    });

    // reload page
    await dashboard.rootPage.reload();

    await grid.column.verify({ title: 'UserField', isVisible: true });

    // delete column and verify
    await grid.column.delete({ title: 'UserField' });
    await grid.column.verify({ title: 'UserField', isVisible: false });
  });

  test('Cell Operation - edit, copy-paste and delete', async () => {
    // set default user
    await grid.column.userOption.selectDefaultValueOption({
      columnTitle: 'User',
      option: users[0],
      multiSelect: false,
    });

    // Edit, refresh and verify
    for (let i = 0; i <= 4; i++) {
      await grid.cell.userOption.select({ index: i, columnHeader: 'User', option: users[i], multiSelect: false });
      await grid.addNewRow({ index: i + 1, value: `Row ${i + 1}` });
    }

    // refresh page
    await topbar.clickRefresh();

    for (let i = 0; i <= 4; i++) {
      await grid.cell.userOption.verify({
        index: i,
        columnHeader: 'User',
        option: users[i],
        multiSelect: false,
      });
    }

    // Delete/clear cell, refresh and verify
    // #1 Using `Delete` keyboard button
    await grid.cell.click({ index: 0, columnHeader: 'User' });
    // trigger delete button key
    await dashboard.rootPage.keyboard.press('Delete');

    // refresh
    await topbar.clickRefresh();

    await grid.cell.userOption.verifyNoOptionsSelected({ index: 0, columnHeader: 'user' });

    // #2 Using mouse click
    await grid.cell.userOption.clear({ index: 1, columnHeader: 'User', multiSelect: false });

    // refresh
    await topbar.clickRefresh();

    await grid.cell.userOption.verifyNoOptionsSelected({ index: 1, columnHeader: 'user' });

    // #3 Using `Cell Context Menu` right click `Clear` option
    await grid.clearWithMouse({ index: 2, columnHeader: 'User' });

    // refresh
    await topbar.clickRefresh();

    await grid.cell.userOption.verifyNoOptionsSelected({ index: 2, columnHeader: 'user' });

    // Copy-paste
    // #1 Using keyboard
    await grid.cell.click({ index: 3, columnHeader: 'User' });
    await dashboard.rootPage.keyboard.press('Shift+ArrowDown');

    await dashboard.rootPage.keyboard.press((await grid.isMacOs()) ? 'Meta+c' : 'Control+c');
    await grid.cell.click({ index: 0, columnHeader: 'User' });
    await dashboard.rootPage.keyboard.press((await grid.isMacOs()) ? 'Meta+v' : 'Control+v');

    // refresh
    await topbar.clickRefresh();

    let counter = 3;
    for (let i = 0; i <= 1; i++) {
      await grid.cell.userOption.verify({
        index: i,
        columnHeader: 'User',
        option: users[counter],
        multiSelect: false,
      });
      counter++;
    }

    // #2 Using cell context menu copy paste option
    await grid.copyWithMouse({ index: 4, columnHeader: 'User' });
    await grid.pasteWithMouse({ index: 0, columnHeader: 'User' });

    // refresh
    await topbar.clickRefresh();

    await grid.cell.userOption.verify({
      index: 0,
      columnHeader: 'User',
      option: users[4],
      multiSelect: false,
    });
  });
});

test.describe('User single select - filter, sort & GroupBy', () => {
  // Row values
  // only user@nocodb.com (row 0)
  // only user-0@nocodb.com (row 1)
  // only user-1@nocodb.com (row 2)
  // only user-2@nocodb.com (row 3)
  // only user-3@nocodb.com (row 4)

  // Example filters:
  //
  // where tags contains all of [user@nocodb.com]
  //   result: rows 0
  // where tags contains any of [user@nocodb.com, user-0@nocodb.com]
  //   result: rows 0,1
  // where tags does not contain any of [user@nocodb.com, user-0@nocodb.com]
  //   result: rows 2,3,4
  // where tags does not contain all of [user-0@nocodb.com]
  //   result: rows 0,2,3,4
  // where tags is not blank
  //   result: rows 0,1,2,3,4
  // where tags is blank
  //   result: null

  let dashboard: DashboardPage, grid: GridPage, toolbar: ToolbarPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.base);
    toolbar = dashboard.grid.toolbar;
    grid = dashboard.grid;

    await dashboard.treeView.createTable({ title: 'sheet1', baseTitle: context.base.title });

    await grid.column.create({ title: 'User', type: 'User' });

    for (let i = 0; i <= 4; i++) {
      await grid.addNewRow({ index: i, value: `${i}` });
      await grid.cell.userOption.select({ index: i, columnHeader: 'User', option: users[i], multiSelect: false });
    }
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  // define validateRowArray function
  async function validateRowArray(value: string[]) {
    const length = value.length;
    for (let i = 0; i < length; i++) {
      await dashboard.grid.cell.verify({
        index: i,
        columnHeader: 'Title',
        value: value[i],
      });
    }
  }

  async function verifyFilter(param: { opType: string; value?: string; result: string[] }) {
    await toolbar.clickFilter();
    await toolbar.filter.add({
      title: 'User',
      operation: param.opType,
      value: param.value,
      locallySaved: false,
      dataType: 'User',
    });
    await toolbar.clickFilter();

    // verify filtered rows
    await validateRowArray(param.result);
    // Reset filter
    await toolbar.filter.reset();
  }

  test('User sort & validate, filter & validate', async () => {
    // Sort ascending and validate
    await toolbar.sort.add({
      title: 'User',
      ascending: true,
      locallySaved: false,
    });
    await validateRowArray(['1', '2', '3', '4', '0']);
    await toolbar.sort.reset();

    // sort descending and validate
    await toolbar.sort.add({
      title: 'User',
      ascending: false,
      locallySaved: false,
    });
    await validateRowArray(['0', '4', '3', '2', '1']);
    await toolbar.sort.reset();

    // filter
    await verifyFilter({ opType: 'contains all of', value: users[0], result: ['0'] });
    await verifyFilter({
      opType: 'contains any of',
      value: `${users[0]},${users[1]}`,
      result: ['0', '1'],
    });
    await verifyFilter({
      opType: 'does not contain any of',
      value: `${users[0]},${users[1]}`,
      result: ['2', '3', '4'],
    });
    await verifyFilter({ opType: 'does not contain all of', value: users[1], result: ['0', '2', '3', '4'] });
    await verifyFilter({ opType: 'is not blank', result: ['0', '1', '2', '3', '4'] });
    await verifyFilter({ opType: 'is blank', result: [] });

    //GroupBy
    // await toolbar.groupBy.add({ title: 'User', ascending: true, locallySaved: false });
  });
});

test.describe('User multiple select', () => {
  let dashboard: DashboardPage, grid: GridPage, topbar: TopbarPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);
    grid = dashboard.grid;
    topbar = dashboard.grid.topbar;

    await dashboard.treeView.createTable({ title: 'Sheet1', baseTitle: context.base.title });

    await grid.column.create({ title: 'User', type: 'User' });
    await grid.column.userOption.allowMultipleUser({ columnTitle: 'User', allowMultiple: true });
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Verify the default option count, select default value and verify', async () => {
    await grid.addNewRow({ index: 0, value: 'Row 0' });

    await grid.column.userOption.verifyDefaultValueOptionCount({ columnTitle: 'User', totalCount: 5 });

    await grid.column.userOption.selectDefaultValueOption({
      columnTitle: 'User',
      option: [users[0], users[1]],
      multiSelect: true,
    });

    // Verify default value is set
    await grid.column.userOption.verifySelectedOptions({
      columnHeader: 'User',
      options: [users[0], users[1]],
    });

    // Add new row and verify default value is added in new cell
    await grid.addNewRow({ index: 1, value: 'Row 1' });
    await grid.cell.userOption.verify({
      index: 1,
      columnHeader: 'User',
      option: users[0],
      multiSelect: true,
    });
    await grid.cell.userOption.verify({
      index: 1,
      columnHeader: 'User',
      option: users[1],
      multiSelect: true,
    });
  });

  test('Cell Operation - edit, copy-paste and delete', async () => {
    // Edit, refresh and verify
    let counter = 1;
    for (let i = 0; i <= 4; i++) {
      await grid.addNewRow({ index: i, value: `Row ${i}` });

      await grid.cell.userOption.select({
        index: i,
        columnHeader: 'User',
        option: users[i],
        multiSelect: true,
      });

      await grid.cell.userOption.select({
        index: i,
        columnHeader: 'User',
        option: users[counter],
        multiSelect: true,
      });
      if (counter === 4) counter = 0;
      else counter++;
    }

    // reload page
    await dashboard.rootPage.reload();

    counter = 1;
    for (let i = 0; i <= 4; i++) {
      await grid.cell.userOption.verifySelectedOptions({
        index: i,
        columnHeader: 'User',
        options: [users[i], users[counter]],
      });
      if (counter === 4) counter = 0;
      else counter++;
    }

    // Delete/clear cell, refresh and verify
    // #1 Using `Delete` keyboard button
    await grid.cell.click({ index: 0, columnHeader: 'User' });
    // trigger delete button key
    await dashboard.rootPage.keyboard.press('Delete');

    // refresh
    await topbar.clickRefresh();

    await grid.cell.userOption.verifyNoOptionsSelected({ index: 0, columnHeader: 'user' });

    // #2 Using mouse click
    await grid.cell.userOption.clear({ index: 1, columnHeader: 'User', multiSelect: true });

    // refresh
    await topbar.clickRefresh();

    await grid.cell.userOption.verifyNoOptionsSelected({ index: 1, columnHeader: 'user' });

    // #3 Using `Cell Context Menu` right click `Clear` option
    await grid.clearWithMouse({ index: 2, columnHeader: 'User' });

    // refresh
    await topbar.clickRefresh();

    await grid.cell.userOption.verifyNoOptionsSelected({ index: 2, columnHeader: 'user' });

    // Copy-paste
    // #1 Using keyboard
    await grid.cell.click({ index: 3, columnHeader: 'User' });

    await dashboard.rootPage.keyboard.press((await grid.isMacOs()) ? 'Meta+c' : 'Control+c');
    await grid.cell.click({ index: 0, columnHeader: 'User' });
    await dashboard.rootPage.keyboard.press((await grid.isMacOs()) ? 'Meta+v' : 'Control+v');

    // refresh
    await topbar.clickRefresh();

    await grid.cell.userOption.verifySelectedOptions({
      index: 0,
      columnHeader: 'User',
      options: [users[3], users[4]],
    });

    // #2 Using cell context menu copy paste option
    await grid.copyWithMouse({ index: 4, columnHeader: 'User' });
    await grid.pasteWithMouse({ index: 1, columnHeader: 'User' });

    // refresh
    await topbar.clickRefresh();

    await grid.cell.userOption.verifySelectedOptions({
      index: 1,
      columnHeader: 'User',
      options: [users[4], users[0]],
    });
  });
});

test.describe('User multiple select - filter, sort & GroupBy', () => {
  // Row values
  // only user@nocodb.com (row 0)
  // user-0@nocodb.com and user-1@nocodb.com (row 1)
  // user-1@nocodb.com and user-2@nocodb.com (row 2)
  // user-2@nocodb.com and user-3@nocodb.com (row 3)
  // user-3@nocodb.com and user@nocodb.com (row 4)

  // Example filters:
  //
  // where tags contains all of [user-0@nocodb.com, user-1@nocodb.com]
  //   result: rows 1
  // where tags contains any of [user@nocodb.com, user-0@nocodb.com]
  //   result: rows 0,1,4
  // where tags does not contain any of [user@nocodb.com, user-0@nocodb.com]
  //   result: rows 2,3
  // where tags does not contain all of [user-0@nocodb.com]
  //   result: rows 0,2,3,4
  // where tags is not blank
  //   result: rows 0,1,2,3,4
  // where tags is blank
  //   result: null

  let dashboard: DashboardPage, grid: GridPage, toolbar: ToolbarPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.base);
    toolbar = dashboard.grid.toolbar;
    grid = dashboard.grid;

    await dashboard.treeView.createTable({ title: 'sheet1', baseTitle: context.base.title });

    await grid.column.create({ title: 'User', type: 'User' });
    await grid.column.userOption.allowMultipleUser({ columnTitle: 'User', allowMultiple: true });

    let counter = 2;
    for (let i = 0; i <= 4; i++) {
      await grid.addNewRow({ index: i, value: `${i}` });
      await grid.cell.userOption.select({ index: i, columnHeader: 'User', option: users[i], multiSelect: true });
      if (i !== 0) {
        await grid.cell.userOption.select({
          index: i,
          columnHeader: 'User',
          option: users[counter],
          multiSelect: true,
        });
        if (counter === 4) counter = 0;
        else counter++;
      }
    }
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  // define validateRowArray function
  async function validateRowArray(value: string[]) {
    const length = value.length;
    for (let i = 0; i < length; i++) {
      await dashboard.grid.cell.verify({
        index: i,
        columnHeader: 'Title',
        value: value[i],
      });
    }
  }

  async function verifyFilter(param: { opType: string; value?: string; result: string[] }) {
    await toolbar.clickFilter();
    await toolbar.filter.add({
      title: 'User',
      operation: param.opType,
      value: param.value,
      locallySaved: false,
      dataType: 'User',
    });
    await toolbar.clickFilter();

    // verify filtered rows
    await validateRowArray(param.result);
    // Reset filter
    await toolbar.filter.reset();
  }

  test('User sort & validate, filter & validate', async () => {
    // Sort ascending and validate
    await toolbar.sort.add({
      title: 'User',
      ascending: true,
      locallySaved: false,
    });
    await validateRowArray(['1', '2', '3', '4', '0']);
    await toolbar.sort.reset();

    // sort descending and validate
    await toolbar.sort.add({
      title: 'User',
      ascending: false,
      locallySaved: false,
    });
    await validateRowArray(['0', '4', '3', '2', '1']);
    await toolbar.sort.reset();

    // filter
    await verifyFilter({ opType: 'contains all of', value: `${(users[1], users[2])}`, result: ['1'] });
    await verifyFilter({
      opType: 'contains any of',
      value: `${users[0]},${users[1]}`,
      result: ['0', '1', '4'],
    });
    await verifyFilter({
      opType: 'does not contain any of',
      value: `${users[0]},${users[1]}`,
      result: ['2', '3'],
    });
    await verifyFilter({ opType: 'does not contain all of', value: users[1], result: ['0', '2', '3', '4'] });
    await verifyFilter({ opType: 'is not blank', result: ['0', '1', '2', '3', '4'] });
    await verifyFilter({ opType: 'is blank', result: [] });

    //GroupBy
    // await toolbar.groupBy.add({ title: 'User', ascending: true, locallySaved: false });
  });
});
