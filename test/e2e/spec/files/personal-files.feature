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

    Scenario: Rename a file
        Given I upload a 1024 byte file
        When  I rename uploaded file to "NEWname русские буквы ελληνικά γράμματα.jpg"
        Then  I have a file named "NEWname русские буквы ελληνικά γράμματα.jpg"
        When  I restart
        Then  I have a file named "NEWname русские буквы ελληνικά γράμματα.jpg"

    Scenario: Remove a file
        Given I upload a 1024 byte file
        And   I see the uploaded file in my drive
        When  I remove the uploaded file
        Then  I have 0 files
        When  I restart
        Then  I have 0 files
