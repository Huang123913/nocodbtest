import { expect, test } from '@playwright/test';
import { DashboardPage } from '../pages/Dashboard';
import setup from '../setup';
import { GridPage } from '../pages/Dashboard/Grid';

interface ExpectedBarcodeData {
  referencedValue: string;
  barcodeSvg: string;
  //   barcodeSvgForModal: string;
}

// interface ExpectedBarcodeDataWithOverlay extends ExpectedBarcodeData {
//   barcodeSvgForModal: string;
// }

// const ONE_SVG_BARCODE_HTML = `<rect x="0" y="0" width="486" height="142" style="fill:#ffffff;"></rect><g transform="translate(10, 10)" style="fill:#000000;"><rect x="0" y="0" width="4" height="100"></rect><rect x="6" y="0" width="2" height="100"></rect><rect x="12" y="0" width="2" height="100"></rect><rect x="22" y="0" width="2" height="100"></rect><rect x="26" y="0" width="2" height="100"></rect><rect x="34" y="0" width="4" height="100"></rect><rect x="44" y="0" width="4" height="100"></rect><rect x="50" y="0" width="4" height="100"></rect><rect x="58" y="0" width="4" height="100"></rect><rect x="66" y="0" width="2" height="100"></rect><rect x="74" y="0" width="2" height="100"></rect><rect x="82" y="0" width="4" height="100"></rect><rect x="88" y="0" width="2" height="100"></rect><rect x="96" y="0" width="8" height="100"></rect><rect x="106" y="0" width="2" height="100"></rect><rect x="110" y="0" width="2" height="100"></rect><rect x="116" y="0" width="2" height="100"></rect><rect x="122" y="0" width="8" height="100"></rect><rect x="132" y="0" width="2" height="100"></rect><rect x="138" y="0" width="8" height="100"></rect><rect x="150" y="0" width="2" height="100"></rect><rect x="154" y="0" width="2" height="100"></rect><rect x="160" y="0" width="2" height="100"></rect><rect x="164" y="0" width="4" height="100"></rect><rect x="176" y="0" width="4" height="100"></rect><rect x="182" y="0" width="4" height="100"></rect><rect x="190" y="0" width="4" height="100"></rect><rect x="198" y="0" width="2" height="100"></rect><rect x="206" y="0" width="4" height="100"></rect><rect x="214" y="0" width="2" height="100"></rect><rect x="220" y="0" width="2" height="100"></rect><rect x="228" y="0" width="4" height="100"></rect><rect x="234" y="0" width="6" height="100"></rect><rect x="242" y="0" width="2" height="100"></rect><rect x="248" y="0" width="2" height="100"></rect><rect x="252" y="0" width="4" height="100"></rect><rect x="264" y="0" width="4" height="100"></rect><rect x="270" y="0" width="4" height="100"></rect><rect x="278" y="0" width="4" height="100"></rect><rect x="286" y="0" width="2" height="100"></rect><rect x="294" y="0" width="2" height="100"></rect><rect x="302" y="0" width="4" height="100"></rect><rect x="308" y="0" width="2" height="100"></rect><rect x="316" y="0" width="8" height="100"></rect><rect x="326" y="0" width="2" height="100"></rect><rect x="330" y="0" width="2" height="100"></rect><rect x="336" y="0" width="2" height="100"></rect><rect x="342" y="0" width="8" height="100"></rect><rect x="352" y="0" width="2" height="100"></rect><rect x="358" y="0" width="8" height="100"></rect><rect x="370" y="0" width="2" height="100"></rect><rect x="374" y="0" width="2" height="100"></rect><rect x="380" y="0" width="2" height="100"></rect><rect x="384" y="0" width="4" height="100"></rect><rect x="396" y="0" width="4" height="100"></rect><rect x="404" y="0" width="2" height="100"></rect><rect x="410" y="0" width="2" height="100"></rect><rect x="418" y="0" width="6" height="100"></rect><rect x="428" y="0" width="4" height="100"></rect><rect x="436" y="0" width="2" height="100"></rect><rect x="440" y="0" width="4" height="100"></rect><rect x="450" y="0" width="6" height="100"></rect><rect x="458" y="0" width="2" height="100"></rect><rect x="462" y="0" width="4" height="100"></rect><text style="font: 20px monospace" text-anchor="middle" x="233" y="122">A Corua (La Corua)</text></g>`;

test.describe('Virtual Columns', () => {
  let dashboard: DashboardPage;
  let grid: GridPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
    grid = dashboard.grid;
  });

  test.describe('Barcode Column', () => {
    async function barcodeColumnVerify(barcodeColumnTitle: string, expectedBarcodeCodeData: ExpectedBarcodeData[]) {
      for (let i = 0; i < expectedBarcodeCodeData.length; i++) {
        await grid.cell.verifyBarcodeCell({
          index: i,
          columnHeader: barcodeColumnTitle,
          expectedSvgValue: expectedBarcodeCodeData[i].barcodeSvg,
        });
      }
    }
    test('creation, showing, updating value and change barcode column title and reference column', async () => {
      // Add qr code column referencing the City column
      // and compare the base64 encoded codes/src attributes for the first 3 rows.
      // Column data from City table (Sakila DB)
      /**
       * City                   LastUpdate              Address List                Country
       * A Corua (La Corua)     2006-02-15 04:45:25     939 Probolinggo Loop        Spain
       * Abha                   2006-02-15 04:45:25     733 Mandaluyong Place       Saudi Arabia
       * Abu Dhabi              2006-02-15 04:45:25     535 Ahmadnagar Manor        United Arab Emirates
       */
      const expectedBarcodeCellValues: ExpectedBarcodeData[] = [
        {
          referencedValue: 'A Corua (La Corua)',
          barcodeSvg:
            '<rect x="0" y="0" width="486" height="142" style="fill:#ffffff;"></rect><g transform="translate(10, 10)" style="fill:#000000;"><rect x="0" y="0" width="4" height="100"></rect><rect x="6" y="0" width="2" height="100"></rect><rect x="12" y="0" width="2" height="100"></rect><rect x="22" y="0" width="2" height="100"></rect><rect x="26" y="0" width="2" height="100"></rect><rect x="34" y="0" width="4" height="100"></rect><rect x="44" y="0" width="4" height="100"></rect><rect x="50" y="0" width="4" height="100"></rect><rect x="58" y="0" width="4" height="100"></rect><rect x="66" y="0" width="2" height="100"></rect><rect x="74" y="0" width="2" height="100"></rect><rect x="82" y="0" width="4" height="100"></rect><rect x="88" y="0" width="2" height="100"></rect><rect x="96" y="0" width="8" height="100"></rect><rect x="106" y="0" width="2" height="100"></rect><rect x="110" y="0" width="2" height="100"></rect><rect x="116" y="0" width="2" height="100"></rect><rect x="122" y="0" width="8" height="100"></rect><rect x="132" y="0" width="2" height="100"></rect><rect x="138" y="0" width="8" height="100"></rect><rect x="150" y="0" width="2" height="100"></rect><rect x="154" y="0" width="2" height="100"></rect><rect x="160" y="0" width="2" height="100"></rect><rect x="164" y="0" width="4" height="100"></rect><rect x="176" y="0" width="4" height="100"></rect><rect x="182" y="0" width="4" height="100"></rect><rect x="190" y="0" width="4" height="100"></rect><rect x="198" y="0" width="2" height="100"></rect><rect x="206" y="0" width="4" height="100"></rect><rect x="214" y="0" width="2" height="100"></rect><rect x="220" y="0" width="2" height="100"></rect><rect x="228" y="0" width="4" height="100"></rect><rect x="234" y="0" width="6" height="100"></rect><rect x="242" y="0" width="2" height="100"></rect><rect x="248" y="0" width="2" height="100"></rect><rect x="252" y="0" width="4" height="100"></rect><rect x="264" y="0" width="4" height="100"></rect><rect x="270" y="0" width="4" height="100"></rect><rect x="278" y="0" width="4" height="100"></rect><rect x="286" y="0" width="2" height="100"></rect><rect x="294" y="0" width="2" height="100"></rect><rect x="302" y="0" width="4" height="100"></rect><rect x="308" y="0" width="2" height="100"></rect><rect x="316" y="0" width="8" height="100"></rect><rect x="326" y="0" width="2" height="100"></rect><rect x="330" y="0" width="2" height="100"></rect><rect x="336" y="0" width="2" height="100"></rect><rect x="342" y="0" width="8" height="100"></rect><rect x="352" y="0" width="2" height="100"></rect><rect x="358" y="0" width="8" height="100"></rect><rect x="370" y="0" width="2" height="100"></rect><rect x="374" y="0" width="2" height="100"></rect><rect x="380" y="0" width="2" height="100"></rect><rect x="384" y="0" width="4" height="100"></rect><rect x="396" y="0" width="4" height="100"></rect><rect x="404" y="0" width="2" height="100"></rect><rect x="410" y="0" width="2" height="100"></rect><rect x="418" y="0" width="6" height="100"></rect><rect x="428" y="0" width="4" height="100"></rect><rect x="436" y="0" width="2" height="100"></rect><rect x="440" y="0" width="4" height="100"></rect><rect x="450" y="0" width="6" height="100"></rect><rect x="458" y="0" width="2" height="100"></rect><rect x="462" y="0" width="4" height="100"></rect><text style="font: 20px monospace" text-anchor="middle" x="233" y="122">A Corua (La Corua)</text></g>',
        },
        {
          referencedValue: 'Abha',
          barcodeSvg:
            '<rect x="0" y="0" width="178" height="142" style="fill:#ffffff;"></rect><g transform="translate(10, 10)" style="fill:#000000;"><rect x="0" y="0" width="4" height="100"></rect><rect x="6" y="0" width="2" height="100"></rect><rect x="12" y="0" width="2" height="100"></rect><rect x="22" y="0" width="2" height="100"></rect><rect x="26" y="0" width="2" height="100"></rect><rect x="34" y="0" width="4" height="100"></rect><rect x="44" y="0" width="2" height="100"></rect><rect x="50" y="0" width="2" height="100"></rect><rect x="60" y="0" width="4" height="100"></rect><rect x="66" y="0" width="2" height="100"></rect><rect x="72" y="0" width="4" height="100"></rect><rect x="84" y="0" width="2" height="100"></rect><rect x="88" y="0" width="2" height="100"></rect><rect x="94" y="0" width="2" height="100"></rect><rect x="98" y="0" width="4" height="100"></rect><rect x="110" y="0" width="6" height="100"></rect><rect x="118" y="0" width="2" height="100"></rect><rect x="124" y="0" width="4" height="100"></rect><rect x="132" y="0" width="4" height="100"></rect><rect x="142" y="0" width="6" height="100"></rect><rect x="150" y="0" width="2" height="100"></rect><rect x="154" y="0" width="4" height="100"></rect><text style="font: 20px monospace" text-anchor="middle" x="79" y="122">Abha</text></g>',
        },
      ];

      // close 'Team & Auth' tab
      await dashboard.closeTab({ title: 'Team & Auth' });

      await dashboard.treeView.openTable({ title: 'City' });

      await grid.column.create({
        title: 'Barcode1',
        type: 'Barcode',
        barcodeValueColumnTitle: 'City',
      });

      await barcodeColumnVerify('Barcode1', expectedBarcodeCellValues);

      await grid.cell.fillText({ columnHeader: 'City', index: 0, text: 'Berlin' });

      const barcodeCellValuesForBerlin = {
        referencedValue: 'Berlin',
        barcodeSvg:
          '<rect x="0" y="0" width="222" height="142" style="fill:#ffffff;"></rect><g transform="translate(10, 10)" style="fill:#000000;"><rect x="0" y="0" width="4" height="100"></rect><rect x="6" y="0" width="2" height="100"></rect><rect x="12" y="0" width="2" height="100"></rect><rect x="22" y="0" width="2" height="100"></rect><rect x="30" y="0" width="2" height="100"></rect><rect x="34" y="0" width="4" height="100"></rect><rect x="44" y="0" width="2" height="100"></rect><rect x="48" y="0" width="4" height="100"></rect><rect x="56" y="0" width="2" height="100"></rect><rect x="66" y="0" width="2" height="100"></rect><rect x="72" y="0" width="2" height="100"></rect><rect x="78" y="0" width="8" height="100"></rect><rect x="88" y="0" width="4" height="100"></rect><rect x="96" y="0" width="2" height="100"></rect><rect x="100" y="0" width="2" height="100"></rect><rect x="110" y="0" width="2" height="100"></rect><rect x="120" y="0" width="4" height="100"></rect><rect x="126" y="0" width="2" height="100"></rect><rect x="132" y="0" width="4" height="100"></rect><rect x="144" y="0" width="2" height="100"></rect><rect x="148" y="0" width="2" height="100"></rect><rect x="154" y="0" width="4" height="100"></rect><rect x="164" y="0" width="2" height="100"></rect><rect x="170" y="0" width="2" height="100"></rect><rect x="176" y="0" width="4" height="100"></rect><rect x="186" y="0" width="6" height="100"></rect><rect x="194" y="0" width="2" height="100"></rect><rect x="198" y="0" width="4" height="100"></rect><text style="font: 20px monospace" text-anchor="middle" x="101" y="122">Berlin</text></g>',
        // barcodeSvgForOverlay:
        //   '<rect x="0" y="0" width="222" height="142" style="fill:#ffffff;"></rect><g transform="translate(10, 10)" style="fill:#000000;"><rect x="0" y="0" width="4" height="100"></rect><rect x="6" y="0" width="2" height="100"></rect><rect x="12" y="0" width="2" height="100"></rect><rect x="22" y="0" width="2" height="100"></rect><rect x="30" y="0" width="2" height="100"></rect><rect x="34" y="0" width="4" height="100"></rect><rect x="44" y="0" width="2" height="100"></rect><rect x="48" y="0" width="4" height="100"></rect><rect x="56" y="0" width="2" height="100"></rect><rect x="66" y="0" width="2" height="100"></rect><rect x="72" y="0" width="2" height="100"></rect><rect x="78" y="0" width="8" height="100"></rect><rect x="88" y="0" width="4" height="100"></rect><rect x="96" y="0" width="2" height="100"></rect><rect x="100" y="0" width="2" height="100"></rect><rect x="110" y="0" width="2" height="100"></rect><rect x="120" y="0" width="4" height="100"></rect><rect x="126" y="0" width="2" height="100"></rect><rect x="132" y="0" width="4" height="100"></rect><rect x="144" y="0" width="2" height="100"></rect><rect x="148" y="0" width="2" height="100"></rect><rect x="154" y="0" width="4" height="100"></rect><rect x="164" y="0" width="2" height="100"></rect><rect x="170" y="0" width="2" height="100"></rect><rect x="176" y="0" width="4" height="100"></rect><rect x="186" y="0" width="6" height="100"></rect><rect x="194" y="0" width="2" height="100"></rect><rect x="198" y="0" width="4" height="100"></rect><text style="font: 20px monospace" text-anchor="middle" x="101" y="122">Berlin</text></g>',
      };

      const barcodeCellValuesForIstanbul = {
        referencedValue: 'Istanbul',
        barcodeSvg:
          '<rect x="0" y="0" width="266" height="142" style="fill:#ffffff;"></rect><g transform="translate(10, 10)" style="fill:#000000;"><rect x="0" y="0" width="4" height="100"></rect><rect x="6" y="0" width="2" height="100"></rect><rect x="12" y="0" width="2" height="100"></rect><rect x="22" y="0" width="4" height="100"></rect><rect x="32" y="0" width="2" height="100"></rect><rect x="40" y="0" width="2" height="100"></rect><rect x="44" y="0" width="2" height="100"></rect><rect x="48" y="0" width="8" height="100"></rect><rect x="60" y="0" width="2" height="100"></rect><rect x="66" y="0" width="2" height="100"></rect><rect x="72" y="0" width="8" height="100"></rect><rect x="82" y="0" width="2" height="100"></rect><rect x="88" y="0" width="2" height="100"></rect><rect x="94" y="0" width="2" height="100"></rect><rect x="98" y="0" width="4" height="100"></rect><rect x="110" y="0" width="4" height="100"></rect><rect x="122" y="0" width="2" height="100"></rect><rect x="126" y="0" width="2" height="100"></rect><rect x="132" y="0" width="2" height="100"></rect><rect x="138" y="0" width="2" height="100"></rect><rect x="148" y="0" width="4" height="100"></rect><rect x="154" y="0" width="2" height="100"></rect><rect x="160" y="0" width="8" height="100"></rect><rect x="172" y="0" width="2" height="100"></rect><rect x="176" y="0" width="4" height="100"></rect><rect x="184" y="0" width="2" height="100"></rect><rect x="188" y="0" width="2" height="100"></rect><rect x="198" y="0" width="4" height="100"></rect><rect x="204" y="0" width="4" height="100"></rect><rect x="214" y="0" width="4" height="100"></rect><rect x="220" y="0" width="4" height="100"></rect><rect x="230" y="0" width="6" height="100"></rect><rect x="238" y="0" width="2" height="100"></rect><rect x="242" y="0" width="4" height="100"></rect><text style="font: 20px monospace" text-anchor="middle" x="123" y="122">Istanbul</text></g>',
        // barcodeSvgForOverlay:
        //   '<rect x="0" y="0" width="222" height="142" style="fill:#ffffff;"></rect><g transform="translate(10, 10)" style="fill:#000000;"><rect x="0" y="0" width="4" height="100"></rect><rect x="6" y="0" width="2" height="100"></rect><rect x="12" y="0" width="2" height="100"></rect><rect x="22" y="0" width="2" height="100"></rect><rect x="30" y="0" width="2" height="100"></rect><rect x="34" y="0" width="4" height="100"></rect><rect x="44" y="0" width="2" height="100"></rect><rect x="48" y="0" width="4" height="100"></rect><rect x="56" y="0" width="2" height="100"></rect><rect x="66" y="0" width="2" height="100"></rect><rect x="72" y="0" width="2" height="100"></rect><rect x="78" y="0" width="8" height="100"></rect><rect x="88" y="0" width="4" height="100"></rect><rect x="96" y="0" width="2" height="100"></rect><rect x="100" y="0" width="2" height="100"></rect><rect x="110" y="0" width="2" height="100"></rect><rect x="120" y="0" width="4" height="100"></rect><rect x="126" y="0" width="2" height="100"></rect><rect x="132" y="0" width="4" height="100"></rect><rect x="144" y="0" width="2" height="100"></rect><rect x="148" y="0" width="2" height="100"></rect><rect x="154" y="0" width="4" height="100"></rect><rect x="164" y="0" width="2" height="100"></rect><rect x="170" y="0" width="2" height="100"></rect><rect x="176" y="0" width="4" height="100"></rect><rect x="186" y="0" width="6" height="100"></rect><rect x="194" y="0" width="2" height="100"></rect><rect x="198" y="0" width="4" height="100"></rect><text style="font: 20px monospace" text-anchor="middle" x="101" y="122">Berlin</text></g>',
      };

      const expectedBarcodeCellValuesAfterCityNameChange = [
        barcodeCellValuesForBerlin,
        ...expectedBarcodeCellValues.slice(1),
      ];
      await barcodeColumnVerify('Barcode1', expectedBarcodeCellValuesAfterCityNameChange);

      await grid.cell.get({ columnHeader: 'Barcode1', index: 0 }).click();
      const barcodeGridOverlay = grid.barcodeOverlay;
      await barcodeGridOverlay.verifyBarcodeSvgValue(barcodeCellValuesForBerlin.barcodeSvg);
      await barcodeGridOverlay.clickCloseButton();

      // Change the QR Code column title
      await grid.column.openEdit({ title: 'Barcode1' });
      await grid.column.fillTitle({ title: 'Barcode1 Renamed' });
      await grid.column.save({ isUpdated: true });
      await barcodeColumnVerify('Barcode1 Renamed', expectedBarcodeCellValuesAfterCityNameChange);

      // Change the referenced column title
      await grid.column.openEdit({ title: 'City' });
      await grid.column.fillTitle({ title: 'City Renamed' });
      await grid.column.save({ isUpdated: true });
      await barcodeColumnVerify('Barcode1 Renamed', expectedBarcodeCellValuesAfterCityNameChange);

      // Change the referenced column
      await grid.column.create({ title: 'New City Column' });
      await grid.cell.fillText({ columnHeader: 'New City Column', index: 0, text: 'Istanbul' });
      await grid.column.openEdit({ title: 'Barcode1 Renamed' });
      await grid.column.changeReferencedColumnForBarcode({ titleOfReferencedColumn: 'New City Column' });

      await barcodeColumnVerify('Barcode1 Renamed', [barcodeCellValuesForIstanbul]);

      await dashboard.closeTab({ title: 'City' });
    });
  });
});
