// supabase/functions/helcim-invoices/index.ts
// Supabase Edge Function to create invoices in Helcim
// Deploy: supabase functions deploy helcim-invoices
// Set secret: supabase secrets set HELCIM_API_TOKEN=your_token_here

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const HELCIM_API_TOKEN = Deno.env.get("HELCIM_API_TOKEN");
    if (!HELCIM_API_TOKEN) {
      return new Response(
        JSON.stringify({ error: "HELCIM_API_TOKEN not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, bills } = await req.json();

    if (action === "create-invoices") {
      // bills is an array of member billing objects
      const results = { success: 0, failed: 0, errors: [] };

      for (const bill of bills) {
        try {
          // Build line items
          const lineItems = [];
          
          if (bill.dues > 0) {
            lineItems.push({
              sku: "ANNUALDUES",
              description: `Annual Dues ${bill.fiscal_year}`,
              quantity: 1,
              price: bill.dues,
            });
          }
          
          if (bill.assessment > 0) {
            lineItems.push({
              sku: "ASSFEE",
              description: `Assessment Fee ${bill.fiscal_year} (Year ${bill.assessment_year_number} of 5)`,
              quantity: 1,
              price: bill.assessment,
            });
          }
          
          if (bill.buyout > 0) {
            lineItems.push({
              sku: "WORKHRS",
              description: `Work Hours Buyout - ${bill.hours_short} hrs @ $${bill.buyout_rate}/hr`,
              quantity: 1,
              price: bill.buyout,
            });
          }

          if (lineItems.length === 0) continue;

          // Build invoice body
          const invoiceBody = {
            invoiceNumber: `INV-${bill.member_number}-${bill.fiscal_year}`,
            currency: "USD",
            type: "INVOICE",
            status: "DUE",
            lineItems: lineItems,
            tax: {
              amount: bill.tax,
              details: "Cabaret Tax 10%",
            },
            billingAddress: {
              name: `${bill.first_name} ${bill.last_name}`,
              street1: bill.address_street || "",
              city: bill.address_city || "",
              province: bill.address_state || "",
              country: "US",
              postalCode: bill.address_zip || "",
              phone: bill.phone || "",
              email: bill.email || "",
            },
            notes: `Member #${bill.member_number} - ${bill.tier} - Fiscal Year ${bill.fiscal_year}`,
          };

          // Call Helcim API
          const response = await fetch("https://api.helcim.com/v2/invoices/", {
            method: "POST",
            headers: {
              "accept": "application/json",
              "content-type": "application/json",
              "api-token": HELCIM_API_TOKEN,
            },
            body: JSON.stringify(invoiceBody),
          });

          const data = await response.json();

          if (response.ok) {
            results.success++;
          } else {
            results.failed++;
            results.errors.push({
              member_number: bill.member_number,
              name: `${bill.last_name}, ${bill.first_name}`,
              error: data.errors || data.message || JSON.stringify(data),
            });
          }
        } catch (err) {
          results.failed++;
          results.errors.push({
            member_number: bill.member_number,
            name: `${bill.last_name}, ${bill.first_name}`,
            error: err.message,
          });
        }
      }

      return new Response(
        JSON.stringify(results),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
