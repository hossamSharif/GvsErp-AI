/**
 * Receipt Template Component
 * Phase 7: User Story 5 - Manage Point of Sale Locations
 * PDF receipt generation using @react-pdf/renderer
 */

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Font,
} from '@react-pdf/renderer';
import type { Invoice, POSLocationSettings } from '@erp/shared';

// Register fonts for proper rendering
Font.register({
  family: 'Roboto',
  fonts: [
    {
      src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf',
    },
    {
      src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf',
      fontWeight: 'bold',
    },
  ],
});

// Styles
const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontSize: 10,
    fontFamily: 'Roboto',
  },
  header: {
    marginBottom: 10,
    textAlign: 'center',
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 5,
    alignSelf: 'center',
  },
  storeName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  headerText: {
    fontSize: 10,
    marginBottom: 2,
  },
  divider: {
    borderBottom: '1px dashed #000',
    marginVertical: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  label: {
    fontSize: 10,
  },
  value: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  itemsHeader: {
    flexDirection: 'row',
    borderBottom: '1px solid #000',
    paddingBottom: 5,
    marginBottom: 5,
    fontWeight: 'bold',
  },
  itemRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  itemName: {
    flex: 3,
    fontSize: 9,
  },
  itemQty: {
    flex: 1,
    textAlign: 'center',
    fontSize: 9,
  },
  itemPrice: {
    flex: 1,
    textAlign: 'right',
    fontSize: 9,
  },
  itemTotal: {
    flex: 1,
    textAlign: 'right',
    fontSize: 9,
  },
  totalsSection: {
    marginTop: 10,
    borderTop: '1px solid #000',
    paddingTop: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  grandTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
    paddingTop: 5,
    borderTop: '2px solid #000',
    fontSize: 12,
    fontWeight: 'bold',
  },
  footer: {
    marginTop: 15,
    textAlign: 'center',
    fontSize: 9,
  },
  barcode: {
    width: 150,
    height: 50,
    marginTop: 10,
    alignSelf: 'center',
  },
});

interface ReceiptProps {
  invoice: Invoice & { items: any[] };
  posLocation: {
    name: string;
    settings: POSLocationSettings;
  };
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
}

export const ReceiptDocument: React.FC<ReceiptProps> = ({
  invoice,
  posLocation,
  storeName = 'ERP Store',
  storeAddress,
  storePhone,
}) => {
  const receiptSettings = posLocation.settings.receipt || {};

  return (
    <Document>
      <Page size="A5" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          {receiptSettings.show_logo && receiptSettings.logo_url && (
            <Image src={receiptSettings.logo_url} style={styles.logo} />
          )}
          <Text style={styles.storeName}>
            {receiptSettings.header || storeName}
          </Text>
          {storeAddress && <Text style={styles.headerText}>{storeAddress}</Text>}
          {storePhone && <Text style={styles.headerText}>Tel: {storePhone}</Text>}
        </View>

        <View style={styles.divider} />

        {/* Invoice Details */}
        <View>
          <View style={styles.row}>
            <Text style={styles.label}>Receipt #:</Text>
            <Text style={styles.value}>{invoice.invoiceNumber}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Date:</Text>
            <Text style={styles.value}>
              {new Date(invoice.createdAt).toLocaleString()}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>POS Location:</Text>
            <Text style={styles.value}>{posLocation.name}</Text>
          </View>
          {invoice.partyId && (
            <View style={styles.row}>
              <Text style={styles.label}>Customer:</Text>
              <Text style={styles.value}>Customer Name</Text>
            </View>
          )}
        </View>

        <View style={styles.divider} />

        {/* Items Table */}
        <View>
          <View style={styles.itemsHeader}>
            <Text style={styles.itemName}>Item</Text>
            <Text style={styles.itemQty}>Qty</Text>
            <Text style={styles.itemPrice}>Price</Text>
            <Text style={styles.itemTotal}>Total</Text>
          </View>

          {invoice.items?.map((item, index) => (
            <View key={index} style={styles.itemRow}>
              <Text style={styles.itemName}>{item.description || 'Item'}</Text>
              <Text style={styles.itemQty}>{item.quantity}</Text>
              <Text style={styles.itemPrice}>${item.unit_price.toFixed(2)}</Text>
              <Text style={styles.itemTotal}>${item.line_total.toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text>Subtotal:</Text>
            <Text>${invoice.subtotal.toFixed(2)}</Text>
          </View>

          {invoice.discountAmount > 0 && (
            <View style={styles.totalRow}>
              <Text>Discount:</Text>
              <Text>-${invoice.discountAmount.toFixed(2)}</Text>
            </View>
          )}

          {invoice.taxAmount > 0 && (
            <View style={styles.totalRow}>
              <Text>Tax:</Text>
              <Text>${invoice.taxAmount.toFixed(2)}</Text>
            </View>
          )}

          <View style={styles.grandTotal}>
            <Text>TOTAL:</Text>
            <Text>${invoice.total.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Barcode (if enabled) */}
        {receiptSettings.show_barcode && (
          <View>
            {/* In production, use a barcode library to generate actual barcode */}
            <Text style={{ textAlign: 'center', fontSize: 8, marginTop: 10 }}>
              {invoice.invoiceNumber}
            </Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>{receiptSettings.footer || 'Thank you for your business!'}</Text>
          <Text style={{ marginTop: 5, fontSize: 8 }}>
            Generated by ERP SaaS Platform
          </Text>
        </View>
      </Page>
    </Document>
  );
};

/**
 * Helper function to generate and download receipt PDF
 */
export const generateReceipt = async (
  invoice: Invoice & { items: any[] },
  posLocation: { name: string; settings: POSLocationSettings },
  storeName?: string,
  storeAddress?: string,
  storePhone?: string
) => {
  // This would be used in a browser context with @react-pdf/renderer
  // Example:
  // import { pdf } from '@react-pdf/renderer';
  // const blob = await pdf(
  //   <ReceiptDocument
  //     invoice={invoice}
  //     posLocation={posLocation}
  //     storeName={storeName}
  //     storeAddress={storeAddress}
  //     storePhone={storePhone}
  //   />
  // ).toBlob();
  // const url = URL.createObjectURL(blob);
  // window.open(url);
};
