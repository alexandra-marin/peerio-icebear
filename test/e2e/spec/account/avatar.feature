# Feature: Avatar

#     Scenario: Add avatar successfully
#         When I upload an avatar
#         Then it should appear in my profile

#     Scenario: Add avatar when another one is being loaded
#         When another avatar upload is in progress
#         Then I should get an error saying Already saving avatar, wait for it to finish.

#     Scenario: Add avatar with wrong number of pictures
#         When the upload does not contain 2 blobs
#         Then I should get an error saying Blobs array length should be 2

#     Scenario: Add avatar with malformed payload
#         When the payload is malformed
#         Then I should get an error saying Blobs should be of ArrayBuffer type

#     Scenario: Remove avatar
#         When I delete my avatar
#         Then my avatar should be empty

#     Scenario: Update avatar
#         Given I have an avatar
#         When I upload a new avatar
#         Then the new avatar should be displayed
