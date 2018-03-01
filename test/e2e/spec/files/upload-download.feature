Feature: Downloading

    Background:
        Given I create my account

    @wip
    @debug
    Scenario: Upload and download a 1024-byte file
        Given I upload a 1024 byte file
        And I see the uploaded file in my drive
        When I download the uploaded file
        Then the uploaded and the downloaded files are the same

    @long
    Scenario: Upload and download a 10-megabyte file
        Given I upload a 10485760 byte file
        And I see the uploaded file in my drive
        When I download the uploaded file
        Then the uploaded and the downloaded files are the same