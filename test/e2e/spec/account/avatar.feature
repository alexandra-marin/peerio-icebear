Feature: Avatar

Background:
    Given I create an account

    Scenario: Upload avatar successfully
        When I upload an avatar
        Then the avatar should appear in my profile
        When I upload an avatar
        Then the avatar should appear in my profile
        When I restart
        Then the avatar should appear in my profile

    Scenario: Concurrent avatar uploads
        Given I start uploading an avatar and do not wait to finish
        Then  saving a new avatar should throw an error

    Scenario: Remove avatar
        Given I upload an avatar
        When  I delete my avatar
        Then  my avatar should be empty
        When  I restart
        Then  my avatar should be empty
