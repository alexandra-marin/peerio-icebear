Feature: Contact management for Medcryptor users

    Scenario: Find a contact by username or email
        Given I create a Medcryptor doctor account
        And   I restart without login
        And   I create my account
        Then  I can see their role in the contact details
        Given I restart without login
        When  I create a Medcryptor admin account
        And   I restart
        Then  I can see their role in the contact details

    Scenario: Sending email templates
        Given I create my account
        When  I invite someone to Peerio
        Then  they receive Peerio templated email
        And   Peerio invites default to Peerio templated email
        And   I restart without login
        Given I create a MedCryptor account
        When  I invite a MedCryptor doctor
        Then  they receive MedCryptor doctor templated email
        When  I invite a MedCryptor patient
        Then  they receive MedCryptor patient templated email
        And   MedCryptor invites default to doctor templated email
