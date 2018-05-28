Feature: MedCryptor users

    Scenario: MedCryptor users have extra data
        Given I create a MedCryptor account with metadata
        Then  I can edit specialization, medical ID, country and role

