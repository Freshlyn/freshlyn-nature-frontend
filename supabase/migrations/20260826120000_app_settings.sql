-- Runtime-tunable constants, editable from the Supabase dashboard without a
-- deploy.
--
-- HISTORY NOTE (recorded 2026-08-27). This file is marked applied on the
-- production project via `supabase migration repair`, not by having been run
-- there. The same schema reached production earlier as four separate
-- migrations -- 20260826102350, 20260826103838, 20260826115556 and
-- 20260826121647 -- which remain in the remote ledger but have no counterpart
-- files here. This consolidated file is the source of truth for a fresh
-- database; those four are historical record.
--
-- One key, `contact`, exists in production with NO migration behind it at all
-- (it was inserted from the dashboard). It IS seeded below, so a database
-- built from this file is complete -- but that is why the seed list here is
-- longer than the four remote migrations combined.
--
-- Key/value with a jsonb payload rather than one column per setting: adding a
-- setting is then an INSERT, not a migration, and the same table holds both
-- scalars (delivery_fee) and structures (delivery_slots, banners) without
-- growing a column each time.
create table public.app_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now()
);

alter table public.app_settings enable row level security;

-- World-readable by design. These values are already visible in the shipped
-- bundle (they are rendered in the cart), so a select policy leaks nothing that
-- view-source does not, and the anon role needs them before login: the cart and
-- the home banner both render logged out.
create policy app_settings_select_all on public.app_settings
  for select to anon, authenticated using (true);

-- Deliberately NO insert/update/delete policy. Every write goes through the
-- dashboard or service_role, both of which bypass RLS. A write policy of any
-- shape would let a customer set their own delivery fee -- and while checkout
-- recomputes the fee server-side and would not honour a tampered client value,
-- a writable row would poison that server-side read too.

-- Instant propagation. Without this line a subscription to the table connects,
-- reports no error, and silently receives nothing forever -- the same trap
-- documented in 20260824000000_subscription_deliveries_realtime.sql.
--
-- Realtime respects RLS, and the select policy above is unconditional, so every
-- connected client (logged in or not) is pushed a dashboard edit as it happens.
alter publication supabase_realtime add table public.app_settings;

-- REPLICA IDENTITY FULL so an UPDATE's payload carries the whole row. The
-- default (primary key only) would push `key` and leave `value` out, which is
-- the one column subscribers actually need.
alter table public.app_settings replica identity full;

-- Seeded from the values the cart was already showing customers (Cart.tsx's
-- FREE_DELIVERY_THRESHOLD/DELIVERY_FEE), which are the real business numbers.
-- The checkout handler's own hardcoded 50/5.00 were placeholders that had
-- drifted: an order under the threshold displayed a 30.00 fee and was charged
-- 5.00. Both sides now read these rows, so the two cannot disagree again.
-- SEED VALUES ONLY -- operators own these at runtime.
--
-- delivery_fee and delivery_slots are edited from the Supabase dashboard as
-- business decisions, and the app reads them from these rows on every load.
-- The numbers below are what production ran on 2026-08-27; they are a starting
-- point for a fresh database, NOT a statement of current truth. Production has
-- already moved past an earlier version of this seed once (fee 30 -> 25, and a
-- fifth 10:00-12:00 window added).
--
-- So: do NOT "correct" production to match this file. If they disagree, the
-- database is right and this seed is stale. Changing a value here only affects
-- databases created from scratch afterwards.
insert into public.app_settings (key, value, description) values
  (
    'delivery_fee',
    '25'::jsonb,
    'Delivery charge in INR applied when the subtotal does not exceed free_delivery_threshold.'
  ),
  (
    'free_delivery_threshold',
    '299'::jsonb,
    'Subtotal in INR above which delivery is free. Strictly greater than: a subtotal exactly equal to this still pays the fee.'
  );

-- The hero carousel, moved out of src/lib/banner-content.ts.
--
-- Seeded from DEFAULT_BANNERS verbatim, which is also the code fallback: a
-- failed fetch renders the same cards rather than an empty hero.
--
-- Two details are load-bearing:
--
--   * The delivery pill reads "{free_delivery_threshold}", not "299". The
--     placeholder is resolved at render time from the row above, so retuning
--     the threshold cannot leave the banner advertising a stale number.
--
--   * milk-subscription carries "enabled": false. Its "Buy 25 Days, Get 30
--     Days" offer is NOT honoured at checkout -- subscription_durations models
--     only discount_percent, and create_order schedules exactly duration_days
--     deliveries, so a customer buying 25 days receives 25. The row is parked
--     here, editable, and must stay disabled until the schema honours it.
insert into public.app_settings (key, value, description) values
  (
    'banners',
    '[{"id":"fast-delivery","title":"Fresh Groceries,","accentText":"Delivered Fast","subtitle":"Get your daily essentials delivered to your doorstep in minutes","pills":[{"icon":"truck","label":"Free over ₹{free_delivery_threshold}"},{"icon":"clock","label":"30 min"}],"imageUrl":"https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400&auto=format&fit=crop","imageAlt":"Fresh Fruits","theme":"green"},{"id":"milk-subscription","title":"Buy 25 Days,","accentText":"Get 30 Days Milk","subtitle":"Subscribe to your daily milk and get 5 extra days free","pills":[{"icon":"milk","label":"Daily delivery"},{"icon":"gift","label":"5 days free"}],"imageUrl":"https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400&auto=format&fit=crop","imageAlt":"Fresh Milk","theme":"amber","enabled":true}]'::jsonb,
    'Hero carousel cards. icon must be truck|clock|milk|gift and theme green|amber -- other values are rejected and the whole setting falls back to the shipped default. "enabled": false parks a card without deleting it. {free_delivery_threshold} in any copy field resolves to that setting at render time.'
  );

-- The legal pages, moved out of src/pages/TermsAndConditions.tsx and
-- src/pages/DataPrivacy.tsx.
--
-- Seeded verbatim from the text that shipped, which is also the code fallback
-- (DEFAULT_TERMS / DEFAULT_PRIVACY in src/lib/legal-content.ts): a failed fetch
-- renders the real policy rather than a blank page, which matters more here
-- than anywhere else -- these are a compliance surface.
--
-- Headings are stored WITHOUT their numbers. numberSections derives them from
-- position at render time, so an operator inserting a clause does not have to
-- renumber every clause below it by hand. An empty heading marks a
-- continuation block and is deliberately skipped by the numbering.
--
-- `contact` is one row read by both pages; it was previously duplicated
-- verbatim in each file, which is exactly how the two drift apart.
insert into public.app_settings (key, value, description) values
  (
    'terms',
    '{"lastUpdated":"May 2, 2026","intro":"Welcome to Freshlyn Nature! These Terms and Conditions govern your use of our mobile application, products, and services offered by Freshlyn Nature (\"the App\"). By accessing or using our App, you agree to comply with and be bound by these Terms and Conditions. If you do not agree with any part of these terms, please do not use the App.","closing":"By using our App, you acknowledge that you have read, understood, and agreed to these Terms and Conditions.","sections":[{"heading":"Definitions","paragraphs":["In these Terms and Conditions:"],"list":["\"Company,\" \"We,\" \"Us,\" \"Our\" refer to Freshlyn Nature.","\"User,\" \"You,\" \"Your\" refer to any person accessing or using our App.","\"Products\" refer to all goods offered for sale through our App.","\"Services\" refer to all services provided by Freshlyn Nature."]},{"heading":"Eligibility","paragraphs":["By using this App, you confirm that:"],"list":["You are at least 18 years old, or","You are using the App under the supervision of a parent or legal guardian."]},{"heading":"Intellectual Property Rights","paragraphs":["Unless otherwise stated, all content within this App, including but not limited to text, images, graphics, logos, product descriptions, videos, and software, is the exclusive property of Freshlyn Nature and is protected by applicable intellectual property laws.","You may not:"],"list":["Copy, reproduce, republish, or redistribute any material.","Sell, rent, or sub-license any content.","Use our trademarks, branding, or logos without prior written permission.","Decompile, reverse-engineer, or attempt to extract the source code of the App, except as permitted by law."]},{"heading":"Products and Services","paragraphs":["Freshlyn Nature offers natural, fresh, and premium-quality products. We strive to ensure that all product descriptions, images, pricing, and availability shown in the App are accurate.","However, we reserve the right to:"],"list":["Modify or discontinue any product without prior notice.","Correct any errors, inaccuracies, or omissions.","Limit product quantities at our sole discretion."]},{"heading":"Food Safety and Product Usage","paragraphs":["All food, dairy, and consumable products sold by Freshlyn Nature are manufactured, processed, and packaged in accordance with applicable food safety standards, including FSSAI regulations.","Customers are responsible for:"],"list":["Checking product labels and expiry dates upon delivery.","Storing products according to the instructions provided.","Consuming products before the recommended date."]},{"heading":"","paragraphs":["Freshlyn Nature shall not be liable for any damage, spoilage, or health issues arising from improper storage, mishandling, or use after delivery."]},{"heading":"Orders and Payments","list":["All orders placed through the App are subject to acceptance and availability.","We reserve the right to refuse or cancel any order at our discretion.","Full payment must be received before order processing.","Prices are subject to change without prior notice.","In case of pricing errors, we reserve the right to cancel the affected order."]},{"heading":"Shipping and Delivery","list":["Delivery timelines shown in the App are estimates only.","Delays may occur due to unforeseen circumstances, including weather, transportation issues, or force majeure events.","Ownership and risk transfer to the customer upon successful delivery."]},{"heading":"Returns, Refunds, and Cancellations","paragraphs":["Please refer to our separate Return and Refund Policy, available within the App, for detailed information regarding returns, refunds, replacements, and cancellations."]},{"heading":"User Reviews and Comments","paragraphs":["Users may post reviews, comments, and feedback within the App.","By submitting content, you represent that:"],"list":["The content is accurate and lawful.","You own or control all rights to the content.","The content does not violate any third-party rights.","The content is not defamatory, offensive, obscene, or misleading."]},{"heading":"","paragraphs":["We reserve the right to monitor, edit, or remove any content without prior notice. By posting content, you grant Freshlyn Nature a non-exclusive, royalty-free, perpetual, and worldwide license to use, reproduce, modify, and publish such content."]},{"heading":"Prohibited Activities","paragraphs":["You agree not to:"],"list":["Use the App for unlawful purposes.","Upload malicious software or harmful code.","Attempt unauthorized access to our systems or App backend.","Interfere with the App''s operation or functionality.","Collect customer data without authorization.","Engage in fraudulent activities."]},{"heading":"Third-Party Services and Links","paragraphs":["The App may contain links to, or integrations with, third-party services or websites. We are not responsible for the content, privacy policies, or practices of such external services."]},{"heading":"Privacy Policy","paragraphs":["Your use of this App is also governed by our Privacy Policy. Please review it carefully."]},{"heading":"Limitation of Liability","paragraphs":["To the fullest extent permitted by law, Freshlyn Nature shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from:"],"list":["Your use of our App.","Purchase or use of our products.","Service interruptions, App downtime, or technical issues.","Errors or omissions in App content."]},{"heading":"Indemnification","paragraphs":["You agree to indemnify and hold harmless Freshlyn Nature, its directors, employees, affiliates, and partners from any claims, liabilities, damages, losses, or expenses arising out of your breach of these Terms."]},{"heading":"Force Majeure","paragraphs":["Freshlyn Nature shall not be held liable for any failure or delay in performance resulting from events beyond our reasonable control, including natural disasters, pandemics, strikes, transportation disruptions, or government actions."]},{"heading":"Governing Law and Jurisdiction","paragraphs":["These Terms and Conditions shall be governed by and construed in accordance with the laws of India.","Any disputes arising out of or relating to these Terms shall be subject to the exclusive jurisdiction of the courts located in Kolkata, West Bengal."]},{"heading":"Changes to Terms","paragraphs":["We reserve the right to update, modify, or replace these Terms and Conditions at any time, with such changes taking effect through an App update or in-app notice.","Your continued use of the App following any changes constitutes acceptance of those changes."]}]}'::jsonb,
    'Terms & Conditions page content. Section headings carry NO numbers -- they are numbered by position at render time, so inserting or reordering a section renumbers the rest automatically. A section with an empty heading is a continuation of the one above and is skipped by the numbering. Legal copy: edit deliberately.'
  ),
  (
    'privacy',
    '{"lastUpdated":"May 2, 2026","intro":"At Freshlyn Nature, we care about your privacy as much as we care about the quality of what we deliver. This Data Privacy and Protection Policy explains what information we collect through our mobile application (\"the App\"), how we use it, and the choices you have to keep it safe.","closing":"Your trust means everything to us. If you ever have questions about how your data is handled, we''re just a message away.","sections":[{"heading":"Information We Collect","paragraphs":["To provide you with our products and services, we may collect:"],"list":["Contact details such as your name, phone number, and email address.","Delivery addresses and location information.","Order history, preferences, and subscription details.","Payment information, processed securely through our payment partners.","Basic device and app usage information to help us improve your experience."]},{"heading":"How We Use Your Information","paragraphs":["We use your information to:"],"list":["Process and deliver your orders accurately and on time.","Keep you updated on order status, offers, and subscription reminders.","Improve the App''s features, performance, and reliability.","Respond to your questions and provide customer support.","Meet legal and regulatory requirements, including food safety compliance."]},{"heading":"How We Protect Your Data","paragraphs":["We take reasonable technical and organizational measures to keep your information safe, including secure storage practices and restricted access to personal data within our team.","Payments made through the App are handled by trusted, secure payment partners — we do not store your full card or banking details on our systems."]},{"heading":"Sharing of Information","paragraphs":["We do not sell your personal information. We may share limited data with:"],"list":["Delivery partners, to fulfill and track your orders.","Payment providers, to process transactions securely.","Service providers who help us operate the App, under confidentiality obligations.","Authorities, only when required by applicable law."]},{"heading":"Your Choices and Rights","paragraphs":["You are always in control of your information. You can:"],"list":["Review and update your profile details from within the App at any time.","Manage or delete saved addresses and payment methods.","Opt out of promotional notifications while still receiving order updates.","Request deletion of your account and associated data by contacting us."]},{"heading":"Data Retention","paragraphs":["We retain your information only for as long as needed to provide our services, meet legal obligations, and resolve disputes. Once no longer required, your data is securely removed."]},{"heading":"Children''s Privacy","paragraphs":["The App is not directed at children. If you are under 18, please use the App only under the supervision of a parent or legal guardian, as outlined in our Terms & Conditions."]},{"heading":"Updates to This Policy","paragraphs":["We may update this policy from time to time to reflect improvements to our practices or changes in the law. Continued use of the App after an update means you accept the revised policy."]}]}'::jsonb,
    'Data Privacy & Protection page content. Same shape and numbering rules as terms. Legal copy: edit deliberately.'
  ),
  (
    'contact',
    '{"address":"Freshlyn Nature, Kolkata, West Bengal, India","email":"info@freshlynnature.com","website":"https://freshlynnature.com/","supportPhone":"+919876543210","supportPhoneDisplay":"+91 98765 43210","supportEmail":"info@freshlynnature.com","supportHours":"8:00 AM - 8:00 PM"}'::jsonb,
    'Contact details shown on /terms, /privacy and the Contact Us sheet. NOTE: supportPhone/supportPhoneDisplay are a PLACEHOLDER number, not a working line -- replace both when the real support line is provisioned (supportPhone must be E.164 with no separators so tel: dials; supportPhoneDisplay is the spaced form shown to users). `email` (general/legal, freshlynnature.com) and `supportEmail` (support, freshlynnature.com) are deliberately different mailboxes, not a typo.'
  );

-- Delivery windows, moved out of src/lib/delivery-slots.ts.
--
-- A slot is a RANGE to the customer ("6:00 AM - 8:00 AM") but only its START is
-- stored: orders.delivery_slot is a Postgres `time`, and create_order derives
-- every subscription_deliveries.scheduled_at as
-- `scheduled_date + delivery_slot`. A range cannot be added to a date. So
-- `value` is the start and is the sole authoritative field; `endValue` is
-- presentation and never crosses the wire.
--
-- That is what makes this a display-only change: widening 7:00 into 6:00-8:00
-- alters what the customer reads, not what the scheduler computes.
--
-- The checkout edge function builds its allowlist from these rows (falling back
-- to its own shipped list if they are unreadable), so adding a window here is
-- honoured without a redeploy.
insert into public.app_settings (key, value, description) values
  (
    'delivery_slots',
    '[{"value":"06:00","endValue":"08:00","shift":"morning"},{"value":"08:00","endValue":"10:00","shift":"morning"},{"value":"10:00","endValue":"12:00","shift":"morning"},{"value":"16:00","endValue":"18:00","shift":"evening"},{"value":"18:00","endValue":"20:00","shift":"evening"}]'::jsonb,
    'Delivery windows offered at checkout. `value` is the window START in 24-hour HH:MM and is the ONLY field stored on the order -- scheduled_at is derived from it, so it must be a valid time. `endValue` is display-only (the label is built as "value - endValue"). `shift` is morning|evening and only groups the buttons. Adding a window here is honoured by checkout without a redeploy; removing one makes it immediately unselectable.'
  );
