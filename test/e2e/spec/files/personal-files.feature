Feature: Personal files

    Background:
        Given I create my account

    Scenario: Upload and download a 1024-byte file
        Given I upload a 1024 byte file
        And   I see the uploaded file in my drive
        When  I download the uploaded file
        Then  the uploaded and the downloaded files are the same

    @long
    Scenario: Upload and download a 10-megabyte file
        Given I upload a 10485760 byte file
        And   I see the uploaded file in my drive
        When  I download the uploaded file
        Then  the uploaded and the downloaded files are the same

    @BOT_NO_ACCOUNT_rename_a_file
    Scenario: Rename a file
        Given I send my credentials to Cucumbot
        And   Cucumbot logs in
        And   I upload a 1024 byte file
        When  I rename uploaded file to "NEWname русские буквы ελληνικά γράμματα.jpg"
        Then  I have a file named "NEWname русские буквы ελληνικά γράμματα.jpg"
        And   Cucumbot has a file named "NEWname русские буквы ελληνικά γράμματα.jpg"
        When  I rename uploaded file to "no extension"
        Then  I have a file named "no extension"
        And   Cucumbot has a file named "no extension"
        When  I restart
        Then  I have a file named "no extension"

    @BOT_NO_ACCOUNT_remove_a_file
    Scenario: Remove a file
        Given I send my credentials to Cucumbot
        And   Cucumbot logs in
        When  I upload a 1024 byte file
        Then  I see the uploaded file in my drive
        And   Cucumbot has 1 files in his drive
        When  I remove the uploaded file
        Then  I have 0 files in my drive
        And   Cucumbot has 0 files in his drive
        When  I restart
        Then  I have 0 files in my drive
